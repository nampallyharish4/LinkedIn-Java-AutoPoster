const axios = require('axios');
const fs = require('fs');
(async () => {
    try {
        const url1 = 'https://image.pollinations.ai/prompt/dog?width=800&height=800&nologo=true';
        let res = await axios.get(url1, { responseType: 'arraybuffer' });
        fs.writeFileSync('out.json', JSON.stringify({ type: 'image.pollinations', length: res.data.length }));
    } catch(e) {
        fs.writeFileSync('out.json', JSON.stringify({ type: 'image err', msg: e.message, code: e.response?.status, data: e.response?.data?.toString() }));
    }
})();
