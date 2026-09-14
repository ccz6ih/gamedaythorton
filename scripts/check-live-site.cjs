const https = require('https');

function getUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`Redirecting (${res.statusCode}) to ${res.headers.location}`);
        return resolve(getUrl(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function check() {
  console.log('Checking live https://www.medbarco.com ...');
  try {
    const res = await getUrl('https://www.medbarco.com');
    console.log('Final Status:', res.status);
    console.log('Headers:', {
      'x-vercel-id': res.headers['x-vercel-id'],
      'age': res.headers['age'],
      'cache-control': res.headers['cache-control']
    });
    
    // Check if the new classes exist in the live body
    const hasIconBox = res.body.includes('sf-item-icon-box');
    const hasServiceSvg = res.body.includes('sf-service-svg');
    const hasEyeLid = res.body.includes('sf-eye-lid-upper');
    const hasNum = res.body.includes('sf-item-num');
    
    console.log('Live page contains sf-item-icon-box:', hasIconBox);
    console.log('Live page contains sf-service-svg:', hasServiceSvg);
    console.log('Live page contains sf-eye-lid-upper:', hasEyeLid);
    console.log('Live page contains sf-item-num:', hasNum);

    if (hasIconBox && hasServiceSvg) {
      console.log('-> Live site HAS the latest commit deployed!');
    } else if (hasNum) {
      console.log('-> Live site has commit d2b7b5b (numerals). Vercel is still building commit 4f4fc9e.');
    } else {
      console.log('-> Live site has an older commit.');
    }
  } catch (err) {
    console.error('Error fetching:', err.message);
  }
}

check();
