from pathlib import Path
from PIL import Image
base = Path('docs/media')
frames = [Image.open(p).convert('RGB') for p in sorted((base / 'frames').glob('*.png'))]
frames[0].save(base / 'demo.gif', save_all=True, append_images=frames[1:], duration=[1600,1600,1400,2000,1600,1400], loop=0, optimize=True)
with Image.open(base / 'demo.gif') as gif:
    duration = 0
    for index in range(gif.n_frames):
        gif.seek(index)
        duration += gif.info.get('duration', 0)
    assert duration < 30000
    print(f'GIF: {gif.n_frames} frames, {duration/1000:.1f}s, {gif.size}')
