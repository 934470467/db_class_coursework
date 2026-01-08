from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
import sys
import io
import contextlib
import pandas as pd
import numpy as np
from sklearn import datasets
import traceback
import matplotlib
matplotlib.use('Agg') # Headless plotting
import matplotlib.pyplot as plt
import base64

# Initialize Firebase
db = None
try:
    # Try to find the key in the current directory
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase initialized successfully.")
except Exception as e:
    print(f"Warning: Firebase initialization failed. Firestore writes will be skipped. Error: {e}")

app = FastAPI()

# Robust CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RunRequest(BaseModel):
    project_id: str
    code: str

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"Global Server Error: {str(exc)}\n{traceback.format_exc()}"
    print(error_msg)
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": str(exc), "traceback": traceback.format_exc()},
    )

@app.post("/run")
async def run_code(request: RunRequest):
    print(f"Received request for project: {request.project_id}")
    
    stdout_capture = io.StringIO()
    execution_error = None
    output = ""
    
    # Sandbox Globals
    sandbox_globals = {
        'pd': pd,
        'np': np,
        'datasets': datasets,
        'print': print, # Ensure print is available
        'plt': plt, # Matplotlib
    }

    try:
        # Capture stdout
        with contextlib.redirect_stdout(stdout_capture):
            try:
                # Execute the code
                exec(request.code, sandbox_globals)
            except Exception as code_exc:
                execution_error = f"{type(code_exc).__name__}: {str(code_exc)}"
                print(f"Code Execution Error: {execution_error}")
                # Print exception to stdout capture so it shows in frontend
                print(f"\nTraceback:\n{traceback.format_exc()}")
        
        output = stdout_capture.getvalue()
        
    except Exception as e:
        # System level error during capture
        execution_error = f"System Error: {str(e)}"
        print(f"System Error: {e}")
        output += f"\nSystem Error: {e}"

    # Append explicit error if present
    if execution_error:
        output += f"\n\n[Execution Failed]\n{execution_error}"
    else:
        output += "\n\n[Execution Successful]"

    print(f"Execution Output: {output[:100]}...")

    # Capture Plot
    image_base64 = None
    if plt.get_fignums():
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        image_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close('all') # Clear figures
        output += "\n\n[Plot Generated]"

    # Write to Firestore
    firestore_status = "skipped"
    if db:
        try:
            result_data = {
                'experimentId': request.project_id,
                'output': output,
                'status': 'Error' if execution_error else 'Success',
                'timestamp': firestore.SERVER_TIMESTAMP,
                'metrics': {'accuracy': 'N/A'}, # Can be enhanced to parse metrics from output
                'agent_suggestion': "Run completed." # Placeholder
            }
            if image_base64:
                result_data['image'] = image_base64
                
            db.collection('experiment_results').add(result_data)
            firestore_status = "written"
            print("Result written to Firestore.")
        except Exception as fs_e:
            print(f"Firestore Write Error: {fs_e}")
            firestore_status = f"failed: {fs_e}"
    
    return {
        "status": "success", 
        "output": output,
        "image": image_base64,
        "firestore_status": firestore_status
    }

# Dataset Upload Endpoint
from fastapi import File, UploadFile
import shutil
import os

@app.post("/upload_dataset")
async def upload_dataset(file: UploadFile = File(...)):
    try:
        # Create datasets directory if not exists
        upload_dir = "datasets"
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
            
        # Secure filename (basic)
        file_path = os.path.join(upload_dir, file.filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"Dataset uploaded: {file.filename}")
        return {"status": "success", "filename": file.filename, "path": file_path}
    except Exception as e:
        print(f"Upload failed: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@app.get("/preview_dataset")
async def preview_dataset(filename: str):
    try:
        file_path = os.path.join("datasets", filename)
        if not os.path.exists(file_path):
             return JSONResponse(status_code=404, content={"status": "error", "message": "File not found"})
        
        if filename.endswith(('.xlsx', '.xls')):
            # Read Excel
            df = pd.read_excel(file_path, nrows=10)
        else:
            # Assume CSV
            df = pd.read_csv(file_path, nrows=10)
        
        # Convert to JSON compatible format
        # Replace NaN with null for JSON compatibility
        df = df.replace({np.nan: None})
        
        # orient='records' gives list of dicts: [{'col1': val, 'col2': val}, ...]
        data = df.to_dict(orient='records')
        
        return {
            "status": "success", 
            "filename": filename,
            "data": data,
            "columns": list(df.columns)
        }
    except Exception as e:
        print(f"Preview failed: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@app.post("/consistency_challenge")
async def consistency_challenge():
    """
    Demonstrates strong consistency by atomically incrementing a global counter.
    This runs inside a Firestore transaction.
    """
    if not db:
        return JSONResponse(status_code=503, content={"status": "error", "message": "Database not connected"})

    try:
        # Reference to the global counter document
        counter_ref = db.collection('global_counters').document('experiment_counter')
        
        # Transactional function
        @firestore.transactional
        def increment_counter(transaction, ref):
            snapshot = ref.get(transaction=transaction)
            current_value = 0
            if snapshot.exists:
                current_value = snapshot.get('count') or 0
            
            new_value = current_value + 1
            transaction.set(ref, {'count': new_value, 'last_updated': firestore.SERVER_TIMESTAMP}, merge=True)
            return new_value

        # Execute transaction
        transaction = db.transaction()
        new_count = increment_counter(transaction, counter_ref)
        
        return {
            "status": "success",
            "message": "Strong Consistency Write Completed",
            "new_value": new_count,
            "consistency_level": "STRONG",
            "timestamp": pd.Timestamp.now().isoformat()
        }
    except Exception as e:
        print(f"Transaction failed: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

if __name__ == "__main__":
    import uvicorn
    # Reload=True depends on file watching which might be flaky in some envs, but good for dev
    uvicorn.run(app, host="0.0.0.0", port=8000)
