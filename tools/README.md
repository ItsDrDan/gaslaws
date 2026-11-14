# Gas Laws checks

`node tools/check-lab.js [n]` (default n = 2000 per family)

Runs the `/*LAB-LOGIC-START*/ … /*LAB-LOGIC-END*/` block of `index.html` in Node and checks every Piston Lab question against an ideal-gas calculation written independently in the test:

- pressure and volume match PV = nRT; a free piston keeps P equal to the outside pressure and never hits a stop
- hits per second × push per hit is proportional to P; particle speed depends only on T and molar mass
- slider targets are on the slider's steps and range
- the prediction key equals the observed ratio, and its wording points the right way
- every wrong explanation has its own feedback; every question has 3 hints
- the Apply answer is recomputed from the numbers printed in its prompt, shows as 3 sig figs, and is not within 2% of a trap value
- no NaN, undefined or raw e-notation in student-facing text
- `parseValue`: decimal commas (2,5) are rejected; thousands separators (1,200) and E notation are accepted

Exit code 1 on any failure.
