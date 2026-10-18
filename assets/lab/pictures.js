// Pictures for the image lab: one is picked at random on each visit.
// Preview one with ?img=N (its position here) or ?img=word (the first src, else alt, containing the word).
// Add a picture: put the original in originals/ (not in git), run
//   python3 -I tools/add_picture.py originals/PHOTO.jpg --name short-name
// and paste the entry it prints here, with alt text and a caption.
// src is relative to the site root; w and h are the webp's pixel size.
var LAB_PICTURES = [
  {
    src: 'assets/butterfly.webp', w: 900, h: 736,
    alt: 'An orange and black butterfly resting on a gray panel with rectangular cutouts showing green leaves',
    caption: 'Butterfly on a perforated panel.'
  }
];
