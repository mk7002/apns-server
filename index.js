const express = require('express');
const http2 = require('http2');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/send', async (req, res) => {
    try {
        const { jwtToken, deviceToken, bundleId, environment = 'sandbox', title, body } = req.body;

        if (!jwtToken || !deviceToken || !bundleId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const host =
            environment === 'production'
                ? 'https://api.push.apple.com'
                : 'https://api.sandbox.push.apple.com';

        const client = http2.connect(host);
        const path = `/3/device/${deviceToken}`;

        const headers = {
            ':method': 'POST',
            ':path': path,
            'authorization': `bearer ${jwtToken}`,
            'apns-topic': bundleId,
            'apns-push-type': 'alert',
            'content-type': 'application/json',
        };

        const payload = JSON.stringify({
            aps: {
                alert: {
                    title: title || 'Hello!',
                    body: body || 'This is a test notification from Render!',
                },
                sound: 'default',
            },
        });

        const request = client.request(headers);

        let responseData = '';

        request.on('response', (headers) => {
            res.status(headers[':status'] || 200);
        });

        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            responseData += chunk;
        });

        request.on('end', () => {
            client.close();
            res.send({ message: 'Notification sent', response: responseData });
        });

        request.on('error', (error) => {
            client.close();
            console.error('APNs Error:', error);
            res.status(500).send({ error: 'Failed to send notification', details: error.message });
        });

        request.write(payload);
        request.end();
    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('APNs Server is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
