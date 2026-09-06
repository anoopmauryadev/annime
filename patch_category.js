const fs = require('fs');
let code = fs.readFileSync('src/app/category/[type]/page.tsx', 'utf8');

code = code.replace(
  'const total = getTotalAnimeCount(queryOpts);',
  'const total = getTotalAnimeCount({ type: isGenre ? undefined : (type === "anime" || type === "cartoon" ? undefined : type), genre: isGenre || type === "anime" || type === "cartoon" ? type : undefined });'
);

fs.writeFileSync('src/app/category/[type]/page.tsx', code);
