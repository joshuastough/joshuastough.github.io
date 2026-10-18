// Pictures for the image lab: one is picked at random on each visit.
// Preview one with ?img=N (its position here) or ?img=word (the first src, else alt, containing the word).
// Add a picture: put the original in originals/ (not in git), run
//   python3 -I tools/add_picture.py originals/PHOTO.jpg --name short-name
// and paste the entry it prints here, with alt text and a caption.
// src is relative to the site root; w and h are the webp's pixel size.
// The starting operation is random too. To pin one for a picture, add op (sampling, quantize,
// blur, edges, hue or dither) and optionally v, its slider value. ?op= and ?v= override both.
var LAB_PICTURES = [
  {
    src: 'assets/butterfly.webp', w: 900, h: 736,
    alt: 'An orange and black butterfly resting on a gray panel with rectangular cutouts showing green leaves',
    caption: 'Butterfly on a perforated panel.'
  },
  {
    src: 'assets/lab/venice-rialto.webp', w: 900, h: 678,
    alt: 'Gondolas moored along wooden posts on the Grand Canal in front of the Rialto Bridge, with a gondolier rowing past',
    caption: 'Gondolas at the Rialto Bridge, Venice.'
  },
  {
    src: 'assets/lab/sunset-big-island.webp', w: 900, h: 678,
    alt: 'The sun setting over the ocean behind a low, dark headland, under streaks of orange cloud',
    caption: 'Sunset on the Big Island.'
  },
  {
    src: 'assets/lab/pond-spillway.webp', w: 900, h: 678,
    alt: 'A still pond on the Carleton College campus reflecting green trees and blue sky, with ducks on a stone spillway in front and a building on the wooded hill behind',
    caption: 'A June morning on the Carleton College campus.'
  },
  {
    src: 'assets/lab/fall-backyard.webp', w: 900, h: 528,
    alt: 'Trees with red and orange leaves, backlit by the sun, above a black metal fence and a green lawn',
    caption: 'Backyard fall colors.'
  },
  {
    src: 'assets/lab/dogwood-sky.webp', w: 900, h: 678,
    alt: 'Looking up through the white blossoms and green leaves of a flowering dogwood into a blue sky',
    caption: 'Dogwood in bloom, looking up.'
  }
];
