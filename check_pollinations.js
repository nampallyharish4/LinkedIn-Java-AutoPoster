const https = require('https');

function checkContent(url, name) {
  https.get(url, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log(name, 'REDIRECT:', res.statusCode, 'to:', res.headers.location);
      checkContent(res.headers.location, name + '-redirect');
    } else {
      console.log(name, 'STATUS:', res.statusCode, 'CONTENT-TYPE:', res.headers['content-type']);
    }
  }).on('error', e => console.error(name, 'ERR:', e.message));
}

checkContent('https://pollinations.ai/p/test', 'p_test');
checkContent('https://image.pollinations.ai/prompt/test', 'image_prompt');
checkContent('https://gen.pollinations.ai/image/test', 'gen_image');
checkContent('https://pollinations.ai/prompt/test', 'prompt_test');
