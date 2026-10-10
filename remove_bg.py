import urllib.request
import subprocess
import sys
import os

def run():
    print("Ensuring rembg is installed...")
    try:
        import rembg
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "rembg", "pillow", "onnxruntime"])
        import rembg
        
    from PIL import Image
    from io import BytesIO

    print("Downloading image...")
    url = "https://img.freepik.com/free-psd/lush-green-plant-white-pot-perfect-home-decor_632498-24124.jpg"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    input_image = Image.open(BytesIO(response.read()))

    print("Removing background...")
    output_image = rembg.remove(input_image)
    
    out_path = os.path.join("client", "public", "hero-plant.png")
    output_image.save(out_path)
    print(f"Background removed and saved to {out_path}")

if __name__ == "__main__":
    run()
