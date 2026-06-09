"""
Flask application for helmet detection.

This application provides a simple web interface for uploading an image and
running it through a pre‑trained object detection model to determine whether
helmets are present.  The core logic is adapted from open source examples
where YOLOv5 is loaded via ``torch.hub`` and the resulting annotated image
is returned to the user.  A results directory under ``static/results`` is
created automatically to store annotated images.

Note: To actually perform inference, you must supply a trained model
weights file (e.g., ``best.pt``) and ensure PyTorch is installed.  The
default path for the weights file is ``weights/best.pt`` relative to the
application root, but this can be overridden by setting the ``MODEL_WEIGHTS``
environment variable.  If the weights are not found or PyTorch isn't
installed, the app will still run but will not annotate images.
"""

import os
from flask import Flask, request, render_template, url_for

import numpy as np
import cv2

try:
    import torch  # type: ignore
except ImportError:
    # PyTorch is optional; the app can still run without performing inference
    torch = None  # type: ignore


def load_model() -> "torch.nn.Module | None":
    """Load the YOLOv5 model if PyTorch is available.

    Returns ``None`` if the model cannot be loaded for any reason.  When
    loading the model the code uses ``torch.hub.load`` to fetch the
    repository ``ultralytics/yolov5`` and a custom model specified by
    ``MODEL_WEIGHTS`` environment variable or a default path.  See the
    project README for details on obtaining the weights file.  Using
    ``trust_repo=True`` (available from PyTorch 1.13 onward) prevents
    warnings about untrusted repositories.
    """
    if torch is None:
        print("PyTorch not installed; model loading skipped.")
        return None
    weights_path = os.environ.get(
        "MODEL_WEIGHTS",
        os.path.join(os.path.dirname(__file__), "weights", "best.pt"),
    )
    if not os.path.isfile(weights_path):
        print(f"Weights file not found at {weights_path}; model loading skipped.")
        return None
    try:
        # The 'custom' argument tells YOLOv5 to load a user‑trained model
        model = torch.hub.load(
            "ultralytics/yolov5", "custom", path=weights_path, trust_repo=True
        )
        # Disable gradient computation for inference
        model.eval()
        return model
    except Exception as exc:
        print(f"Could not load YOLO model: {exc}")
        return None


def create_app() -> Flask:
    """Factory function to create and configure the Flask application."""
    app = Flask(__name__)

    # Directory where annotated images will be saved.  Using ``app.root_path``
    # ensures that the directory resides alongside this module regardless of
    # the current working directory.
    results_dir = os.path.join(app.root_path, "static", "results")
    os.makedirs(results_dir, exist_ok=True)

    # Load the model once when the app starts.  If loading fails the variable
    # will be ``None`` and prediction will be skipped.
    model = load_model()

    @app.route("/")
    def index() -> str:
        """Render the upload form.  Displays the last result if available."""
        return render_template("index.html")

    @app.route("/predict", methods=["POST"])
    def predict():
        """Handle image upload and run inference to detect helmets.

        The endpoint expects a file input named ``file``.  If a model is
        loaded, it will annotate the image and save it into the results
        directory.  The annotated image's relative path is passed back to
        the template for display.  Errors (e.g., no file uploaded) are
        returned to the user via the template.
        """
        upload = request.files.get("file")
        if not upload or upload.filename == "":
            return render_template(
                "index.html", error="Please select an image to upload."
            )

        # Read the uploaded image into a NumPy array
        file_bytes = np.fromfile(upload, np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if img is None:
            return render_template(
                "index.html",
                error="The uploaded file could not be processed as an image.",
            )

        annotated_path = None
        if model is not None:
            # Perform inference; results.render() returns a list of annotated
            # images corresponding to the input batch.  Here we upload a
            # single image, so take the first result.
            results = model(img)
            annotated_image = results.render()[0]  # type: ignore[index]
            # Construct a filename based on the original name
            name, _ = os.path.splitext(upload.filename)
            filename = f"{name}_result.jpg"
            annotated_path = os.path.join(results_dir, filename)
            # Save the image in BGR format expected by OpenCV
            cv2.imwrite(annotated_path, annotated_image)

        # Build a relative URL for the saved image so that it can be served
        relative_image = (
            url_for("static", filename=f"results/{os.path.basename(annotated_path)}")
            if annotated_path
            else None
        )
        return render_template("index.html", image=relative_image)

    return app


app = create_app()
application = app


if __name__ == "__main__":
    # When run directly, create the app and run the development server.  The
    # host is set to 0.0.0.0 to allow access via Docker or remote hosts.
    app.run(host="0.0.0.0", port=5000, debug=True)
