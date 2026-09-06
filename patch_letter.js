const fs = require('fs');
let code = fs.readFileSync('src/app/letter/[letter]/page.tsx', 'utf8');

code = code.replace(
  'const total = getTotalAnimeCount(queryOpts);',
  'const total = getTotalAnimeCount({ letter: letter === "0-9" ? "0-9" : letter });'
);

fs.writeFileSync('src/app/letter/[letter]/page.tsx', code);
