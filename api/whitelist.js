import axios from 'axios';

const REPO_OWNER = 'NewWhitelistService'; // Your GitHub username
const REPO_NAME = 'NewWhitelistService.github.io'; // Your repository name
const FILE_PATH = 'whitelist.json'; // The path to your whitelist file

const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Use GitHub token from environment variables

// Function to fetch the whitelist.json file
const getWhitelist = async () => {
    try {
        const response = await axios.get(GITHUB_API_URL, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
            },
        });
        const content = Buffer.from(response.data.content, 'base64').toString();
        return JSON.parse(content);
    } catch (error) {
        throw error;
    }
};

// Function to update the whitelist.json file
const updateWhitelist = async (newWhitelist) => {
    try {
        const newContent = Buffer.from(JSON.stringify(newWhitelist, null, 2)).toString('base64');
        const sha = (await getWhitelist()).sha; // Get the current file's SHA

        // Update the file in GitHub
        await axios.put(GITHUB_API_URL, {
            message: 'Update whitelist',
            content: newContent,
            sha: sha,
        }, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
            },
        });
    } catch (error) {
        throw error;
    }
};

// Function to generate a random key
const generateRandomKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
};

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { product, ownerId } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product]) {
                whitelist[product] = {
                    ownerId: ownerId,
                    keys: {},
                };
            }

            // Generate keys for the product
            const keys = [];
            for (let i = 0; i < 5; i++) { // Create 5 keys for the product
                const key = generateRandomKey();
                keys.push(key);
                whitelist[product].keys[key] = { ownerId: null, hwid: null };
            }

            await updateWhitelist(whitelist);
            res.status(200).json({ status: 'success', keys });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create product' });
        }
    } else if (req.method === 'PATCH') {
        const { product, key, userId, hwid } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product] || !whitelist[product].keys[key]) {
                return res.status(404).json({ status: 'error', message: 'Key not found' });
            }

            const keyInfo = whitelist[product].keys[key];

            // Check if the key has already been redeemed
            if (keyInfo.ownerId) {
                return res.status(403).json({ status: 'error', message: 'Key has already been redeemed' });
            }

            // If HWID is not set, set it
            if (!keyInfo.hwid) {
                keyInfo.hwid = hwid;
            }

            // Assign the user ID to the key
            keyInfo.ownerId = userId;

            await updateWhitelist(whitelist);
            res.status(200).json({ status: 'success', message: 'Key redeemed successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to redeem key' });
        }
    } else if (req.method === 'PUT') {
        const { product, key, userId } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product] || !whitelist[product].keys[key]) {
                return res.status(404).json({ status: 'error', message: 'Key not found' });
            }

            const keyInfo = whitelist[product].keys[key];

            // Ensure the user ID matches the owner
            if (keyInfo.ownerId !== userId) {
                return res.status(403).json({ status: 'error', message: 'You do not have permission to reset HWID for this key' });
            }

            // Reset the HWID
            keyInfo.hwid = null;

            await updateWhitelist(whitelist);
            res.status(200).json({ status: 'success', message: 'HWID reset successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to reset HWID' });
        }
    } else {
        res.status(405).json({ error: 'Only POST, PATCH, and PUT requests are allowed' });
    }
}
