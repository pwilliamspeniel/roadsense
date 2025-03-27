# # Import necessary libraries
# from fastapi import FastAPI, HTTPException
# from pydantic import BaseModel
# import onnxruntime as rt
# import numpy as np
# import pandas as pd
# import os 

# # Initialize FastAPI app
# app = FastAPI()

# # Load the ONNX model
# model_directory = os.path.dirname(os.path.abspath(__file__))
# onnx_model_path = os.path.join(model_directory, "xgb_model.onnx")  

# try:
#     sess = rt.InferenceSession(onnx_model_path)
# except Exception as e:
#     print(f"Failed to load ONNX model: {e}")
#     raise

# # Define the request body model (input data format)
# class ModelInput(BaseModel):
#     acclerationY: list[float]
#     accelerationZ: list[float]
#     speedv: list[float]
#     unixTimestamp: list[int]
#     latitude: list[float]
#     longitude: list[float]

# # Define the /predict route
# @app.post("/predict")
# async def predict(input: ModelInput):
#     try:
#         # Convert the input data to a pandas DataFrame
#         input_data = pd.DataFrame({
#             'accelerationY': input.accelerationY,
#             'accelerationZ': input.accelerationZ,
#             'speedv': input.speedv,
#             'unixTimestamp': input.unixTimestamp,
#             'latitude': input.latitude,
#             'longitude': input.longitude
#         })

#         # Ensure columns are in the correct order (same as expected by the model)
#         required_columns = ['accelerationY', 'accelerationZ', 'speedv', 'unixTimestamp', 'latitude', 'longitude']
#         input_data = input_data[required_columns].values.astype(np.float32)

#         # Get the input name and make predictions
#         input_name = sess.get_inputs()[0].name
#         predictions = sess.run(None, {input_name: input_data})[0]

#         # Return predictions as a list in JSON format
#         return {"predictions": predictions.tolist()}

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# # Optional root endpoint
# @app.get("/")
# def root():
#     return {"message": "ONNX Model Prediction API"}


# Import necessary libraries
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import onnxruntime as rt
import numpy as np
import pandas as pd
import os 

# Initialize FastAPI app
app = FastAPI()

# Configure ONNX Runtime session options to limit threads and disable affinity
session_options = rt.SessionOptions()
session_options.inter_op_num_threads = 1  # Limit inter-operation threads
session_options.intra_op_num_threads = 1  # Limit intra-operation threads
session_options.execution_mode = rt.ExecutionMode.ORT_SEQUENTIAL  # Sequential execution

# Load the ONNX model
model_directory = os.path.dirname(os.path.abspath(__file__))
onnx_model_path = os.path.join(model_directory, "xgb_model.onnx")  

try:
    sess = rt.InferenceSession(onnx_model_path, session_options)
except Exception as e:
    print(f"Failed to load ONNX model: {e}")
    raise

# Define the request body model (input data format)
class ModelInput(BaseModel):
    accelerationY: list[float]  # Note: 'acclerationY' seems like a typo; should it be 'accelerationY'?
    accelerationZ: list[float]
    speedv: list[float]
    unixTimestamp: list[int]
    latitude: list[float]
    longitude: list[float]

# Define the /predict route
@app.post("/predict")
async def predict(input: ModelInput):
    try:
        # Convert the input data to a pandas DataFrame
        input_data = pd.DataFrame({
            'accelerationY': input.accelerationY,
            'accelerationZ': input.accelerationZ,
            'speedv': input.speedv,
            'unixTimestamp': input.unixTimestamp,
            'latitude': input.latitude,
            'longitude': input.longitude
        })

        # Ensure columns are in the correct order (same as expected by the model)
        required_columns = ['accelerationY', 'accelerationZ', 'speedv', 'unixTimestamp', 'latitude', 'longitude']
        input_data = input_data[required_columns].values.astype(np.float32)

        # Get the input name and make predictions
        input_name = sess.get_inputs()[0].name
        predictions = sess.run(None, {input_name: input_data})[0]

        # Return predictions as a list in JSON format
        return {"predictions": predictions.tolist()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# Optional root endpoint
@app.get("/")
def root():
    return {"message": "ONNX Model Prediction API"}