# Living Lab Imagery

The homepage explorer uses reference photography for the four system themes; the images are not presented as a surveyed map or verified photographs of Udyaan facilities.

- Sense: existing aerial-film poster, credited to Serg Alesenko / Pexels.
- Grow: existing greenhouse photograph, credited to Mark Stebnicki / Pexels.
- Power: [solar-panel photograph](https://images.unsplash.com/photo-1509391366360-2e959784a276), Unsplash. Stored locally as `public/lab-solar.jpg`.
- Return: [soil and planting-bench photograph](https://images.unsplash.com/photo-1416879595882-3373a0480b5b), Unsplash. Stored locally as `public/lab-soil.jpg`.

The two added images are used under the [Unsplash license](https://unsplash.com/license). Images are served locally, with no runtime dependency on Unsplash.

The four tabs support Left/Right, Home, and End keys, with roving keyboard focus and reduced-motion support. `tests/living-lab-browser-checks.js` is an async Playwright page function following the existing browser-check convention. It checks all four panels at desktop, tablet, and phone widths, image loading, layout stability, keyboard navigation, reduced motion, and destination links. Screenshots are written to `/tmp/living-lab-*.png`.