# Deployment configuration 
import modal

app = modal.App("ps-scorer")

# defines cloud envrionment 
image = (
    modal.Image.debian_slim()
    .pip_install([
        "fastapi",
        "uvicorn[standard]",
        "pydantic",
        "transformers",
        "accelerate",
        "bitsandbytes",
        "peft",
        "torch",
    ])
    .add_local_dir(".", remote_path="/app")  # ✅ MUST BE LAST
)

# requests GPU 
@app.function(
    image=image,
    gpu="T4",
    timeout=600,
)

# react frontend can call this 
@modal.asgi_app()
def fastapi_app():
    import sys
    sys.path.insert(0, "/app")
    from main import app as fastapi_app
    return fastapi_app