import base64
from google.cloud import aiplatform
from google.cloud.aiplatform.gapic.schema import predict
import cv2
from flask import Flask, jsonify
from google.protobuf.json_format import MessageToDict
import json 
from google.protobuf.internal.containers import RepeatedCompositeFieldContainer
import os
from dotenv import load_dotenv
from google.protobuf.descriptor import FieldDescriptor

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

PROJECT = os.getenv('GCLOUD_PROJECT')
ENDPOINT_ID = os.getenv('ENDPOINT_ID')
LOCATION = os.getenv('LOCATION')
API_ENDPOINT = os.getenv('API_ENDPOINT')

def predict_image_object_detection_sample(
    project: str,
    endpoint_id: str,
    image_bytes: bytes,
    location: str,
    api_endpoint: str,
):
    # The AI Platform services require regional API endpoints.
    client_options = {"api_endpoint": api_endpoint}
    # Initialize client that will be used to create and send requests.
    # This client only needs to be created once, and can be reused for multiple requests.
   # print("this is prediction function:",type(image_bytes))
    client = aiplatform.gapic.PredictionServiceClient(client_options=client_options)
    encoded_content = base64.b64encode(image_bytes).decode("utf-8")
    instance = predict.instance.ImageClassificationPredictionInstance(
        content=encoded_content,
    ).to_value()
    instances = [instance]
    # See gs://google-cloud-aiplatform/schema/predict/params/image_classification_1.0.0.yaml for the format of the parameters.
    parameters = predict.params.ImageClassificationPredictionParams(
        confidence_threshold=0.5,
        max_predictions=5,
    ).to_value()
    endpoint = client.endpoint_path(
        project=project, location=location, endpoint=endpoint_id
    )
    response = client.predict(
        endpoint=endpoint, instances=instances, parameters=parameters
    )
    predictions = response.predictions
    # for prediction in predictions:
    #     print(" prediction:", dict(prediction))
    #     #json_output = json.dumps(dict(prediction)) # Convert to JSON string
    #     #print(json_output)
    return predictions

def predictions_to_json(predictions):
    """Converts prediction results to JSON, handling nested repeated fields."""

    def convert_repeated_composite(repeated_field):
        """Recursively converts RepeatedComposite fields to lists of dictionaries."""
        if isinstance(repeated_field, RepeatedCompositeFieldContainer):
            return [convert_to_dict(item) for item in repeated_field] # Recursive call
        return repeated_field


    def convert_to_dict(message):
        """Converts a protobuf message to a dictionary, handling map and repeated fields."""
        if hasattr(message, "DESCRIPTOR"):
            message_dict = MessageToDict(message, preserving_proto_field_name=True)

            # Handle map fields
            for field in message.DESCRIPTOR.fields:
                if field.type == FieldDescriptor.TYPE_MESSAGE and field.message_type.has_options and field.message_type.GetOptions().map_entry:
                    if field.name not in message_dict:
                        message_dict[field.name] = {}

            # Handle nested repeated composite fields recursively
            for key, value in message_dict.items():
                message_dict[key] = convert_repeated_composite(value)

            return message_dict
        elif isinstance(message, list): # Handle lists (might contain more protobuf messages)
            return [convert_to_dict(item) for item in message]
        return message


    try:
        if isinstance(predictions, list):
            predictions_list = [convert_to_dict(p) for p in predictions] # Use the recursive function
            return json.dumps({'predictions': predictions_list})
        elif isinstance(predictions, dict): # Already a dictionary
            return json.dumps({'predictions': predictions})
        elif hasattr(predictions, "DESCRIPTOR"):
            predictions_dict = convert_to_dict(predictions) # Use the recursive function
            return json.dumps({'predictions': predictions_dict})
        else:
            return json.dumps({'predictions': predictions})
    except Exception as e:
        print(f"Error converting predictions to JSON: {e}")
        return json.dumps({'error': str(e)})

def check_for_object(predictions, target_object, confidence_threshold=0.5):
    for prediction in predictions:
        if "displayNames" in prediction and "confidences" in prediction:  # Check keys exist
            display_names = prediction["displayNames"]
            confidences = prediction["confidences"]

            for i in range(min(len(display_names), len(confidences))):  # Iterate safely
                if display_names[i] == target_object and confidences[i] >= confidence_threshold:
                    return True
    return False

def identify_objects(predictions, confidence_threshold=0.5):
    identified_objects = []
    if predictions:
        for prediction in predictions:
            if "displayNames" in prediction and "confidences" in prediction and "bboxes" in prediction:
                display_names = prediction["displayNames"]
                confidences = prediction["confidences"]
                bboxes = prediction["bboxes"]

                for i in range(min(len(display_names), len(confidences), len(bboxes))):
                    if confidences[i] >= confidence_threshold:
                        identified_objects.append({
                            "displayName": display_names[i],
                            "confidence": confidences[i],
                            "bbox": bboxes[i]
                        })
    #print("identi", identified_objects)

    json_string = '{"predictions": ['

    for i, prediction in enumerate(identified_objects):
        json_string += '{'
        json_string += f'"displayName": "{prediction["displayName"]}",'
        json_string += f'"confidence": {prediction["confidence"]},'
        json_string += '"bbox": ['
        for j, coord in enumerate(prediction["bbox"]):
            json_string += str(coord)
            if j < len(prediction["bbox"]) - 1:
                json_string += ","
        json_string += ']'
        json_string += '}'
        if i < len(identified_objects) - 1:
            json_string += ','

    json_string += ']}'
    #json_output = json.dumps({json_string}, indent=4)
    print(json_string)
    return json_string

def capture_and_predict(project, endpoint_id, location, api_endpoint):
    """Captures an image from the webcam and sends it for prediction."""

    try:
        # Initialize camera
        cap = cv2.VideoCapture(0)  # 0 usually refers to the default webcam

        if not cap.isOpened():
            raise IOError("Cannot open webcam")

        ret, frame = cap.read()  # Capture a frame

        if not ret:
            raise IOError("Cannot read frame from webcam")

        # Encode the frame as JPEG
        _, image_bytes = cv2.imencode('.jpg', frame)

        cap.release()  # Release the camera

        filename = "extinguisher.jpg"
        with open(filename, "rb") as f:
            file_content = f.read()
            #print(type(file_content))

        # Perform prediction
        predictions = predict_image_object_detection_sample(
            project=project,
            endpoint_id=endpoint_id,
            #image_bytes=image_bytes.tobytes(),
            image_bytes=file_content,  # Convert to bytes
            location=location,
            api_endpoint=api_endpoint
        )

        return predictions

    except Exception as e:
        print(f"Error during capture and prediction: {e}")
        return None
    
if __name__ == "__main__":
    print("imageObjectIdentify.py script started")
    import sys
    try:
        # Expect image path as first argument
        if len(sys.argv) < 2:
            print("No image path provided. Usage: python imageObjectIdentify.py <image_path>")
            sys.exit(1)
        image_path = sys.argv[1]
        print(f"Image path received: {image_path}")
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        # Use env vars loaded earlier
        if not all([PROJECT, ENDPOINT_ID, LOCATION, API_ENDPOINT]):
            print("One or more required environment variables are missing.")
            print(f"PROJECT={PROJECT}, ENDPOINT_ID={ENDPOINT_ID}, LOCATION={LOCATION}, API_ENDPOINT={API_ENDPOINT}")
            sys.exit(1)
        predictions = predict_image_object_detection_sample(
            project=PROJECT,
            endpoint_id=ENDPOINT_ID,
            image_bytes=image_bytes,
            location=LOCATION,
            api_endpoint=API_ENDPOINT
        )
        print("Prediction result:")
        print(predictions_to_json(predictions))
    except Exception as e:
        print(f"Error in main block: {e}")
