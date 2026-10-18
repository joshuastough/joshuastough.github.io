## joshuastough.github.io

Source for [joshuastough.github.io](https://joshuastough.github.io/), the personal page of Joshua Stough. Its centerpiece is a small image-processing lab: a photo you can sample, quantize, blur, edge-detect, hue-shift, saturate or dither in the browser, with each operation linked to its notebook in [Digital Image Processing in Python](https://profstough.github.io/imageprocessing-awesome/).

The site is a single static `index.html` with inline CSS and JavaScript (no Jekyll; see `.nojekyll`).

- `assets/lab/pictures.js`: the lab's pictures. One is picked at random on each visit, and so is the starting operation. Preview a picture with `?img=N` or `?img=word`, and an operation with `?op=dither&v=4`.
- `assets/lab/*.webp`: the pictures, at most 900px, with all metadata (including GPS) stripped. `assets/butterfly.webp` comes from `butterfly.png`, the full-resolution original.
- `assets/social.jpg`: the link-preview image.
- `sitemap.xml` and `robots.txt`: for search engines; the sitemap lists only the home page.

### Adding a picture
Put the original photo in `originals/`. Git ignores that folder, so originals and their GPS data never get committed. Then run

```sh
python3 -I tools/add_picture.py originals/PHOTO.jpg --name short-name
```

and paste the entry it prints into `assets/lab/pictures.js`, adding alt text and a caption.

### Previewing
- `tools/serve.sh` serves the site at http://localhost:8000/.
- `fonts-preview.html` shows the real page side by side in other text fonts (Newsreader is the one in use).
- `python3 -I tools/shoot.py OUTDIR` takes headless-Chrome screenshots at desktop and phone widths, in light and dark, and flags horizontal overflow.
