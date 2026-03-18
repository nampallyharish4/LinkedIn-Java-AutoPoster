const axios = require('axios');
(async () => {
    try {
        let res = await axios.head('https://image.pollinations.ai/prompt/test');
        console.log('image:', res.status, res.headers['content-type']);
    } catch(e) { console.log('image err:', e.message); }
    
    try {
        let res2 = await axios.head('https://pollinations.ai/p/test');
        console.log('p:', res2.status, res2.headers['content-type']);
    } catch(e) { console.log('p err:', e.message); }

    try {
        let res3 = await axios.head('https://gen.pollinations.ai/image/test');
        console.log('gen:', res3.status, res3.headers['content-type']);
    } catch(e) { console.log('gen err:', e.message); }
})();
