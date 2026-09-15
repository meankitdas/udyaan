# Living Lab Imagery

The homepage explorer uses reference photography for the four system themes; the images are not presented as a surveyed map or verified photographs of Udyaan facilities.

- Sense: existing aerial-film poster, credited to Serg Alesenko / Pexels.
- Grow: existing greenhouse photograph, credited to Mark Stebnicki / Pexels.
- Power: [solar-panel photograph](https://images.unsplash.com/photo-1509391366360-2e959784a276), Unsplash. Stored locally as `public/lab-solar.jpg`.
- Return: [soil and planting-bench photograph](https://images.unsplash.com/photo-1416879595882-3373a0480b5b), Unsplash. Stored locally as `public/lab-soil.jpg`.

The two added images are used under the [Unsplash license](https://unsplash.com/license). Images are served locally, with no runtime dependency on Unsplash.

## Public Platform Photography

These reference images illustrate collaboration, product design and technical building. They are not photographs of Udyaan teams, facilities or completed projects. Public captions identify them as reference photography.

- Collaboration: [team at work](https://images.unsplash.com/photo-1522071820081-009f0129c71c), stored locally as `public/builder-team.jpg`.
- Product design: [sketching a user flow](https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e), stored locally as `public/builder-design.jpg`.
- Technical building: [circuit-board detail](https://images.unsplash.com/photo-1518770660439-4636190af475), stored locally as `public/builder-electronics.jpg`.

All three use the [Unsplash license](https://unsplash.com/license), are downloaded at 1600px width, and are served through Next.js Image with responsive sizes and lazy loading. Replace them with approved programme photography when available.

The full-height homepage hero uses a separate [landscape reference photograph](https://images.unsplash.com/photo-1500382017468-9049fed747ef), stored as `public/udyaan-landscape.jpg` at 2560px width under the same Unsplash license. It is not a photograph of Udyaan's campus. This priority-loaded image replaces the low-resolution aerial-video poster in the hero only.

## Homepage Design References

Reviewed September 12, 2026: [Techstars](https://www.techstars.com/), [Y Combinator](https://www.ycombinator.com/), and [Berkeley SkyDeck](https://skydeck.berkeley.edu/). The revised homepage uses their general patterns of focused positioning, direct audience routes and evidence-led progression, not their copy, portfolio claims or brand assets. Techstars was also inspected in the browser; the YC browser headline check timed out, so its comparison was limited to retrieved page content.

The header and hero together fill the dynamic viewport. Content may grow on unusually short screens or with enlarged text rather than clipping controls. The lower hero links introduce the model and company pathway. Homepage-specific styling keeps the new hierarchy separate from portal and task interfaces.

The four tabs support Left/Right, Home, and End keys, with roving keyboard focus and reduced-motion support. `tests/living-lab-browser-checks.js` is an async Playwright page function following the existing browser-check convention. It checks all four panels at desktop, tablet, and phone widths, image loading, layout stability, keyboard navigation, reduced motion, and destination links. Screenshots are written to `/tmp/living-lab-*.png`.