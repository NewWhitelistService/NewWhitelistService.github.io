import axios from 'axios';

const REPO_OWNER = 'NewWhitelistService'; // Your GitHub username
const REPO_NAME = 'NewWhitelistService.github.io'; // Your repository name
const FILE_PATH = 'whitelist.json'; // The path to your whitelist file

const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Use GitHub token from environment variables

// Function to fetch the whitelist.json file
const getWhitelist = async () => {
    try {
        console.log("Fetching whitelist..."); // Log
        const response = await axios.get(GITHUB_API_URL, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
            },
        });
        const content = Buffer.from(response.data.content, 'base64').toString();
        return JSON.parse(content);
    } catch (error) {
        console.error("Failed to fetch whitelist:", error.response ? error.response.data : error.message);
        throw error;
    }
};

// Function to update the whitelist.json file
const updateWhitelist = async (newWhitelist) => {
    try {
        const response = await axios.get(GITHUB_API_URL, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
            },
        });

        const newContent = Buffer.from(JSON.stringify(newWhitelist, null, 2)).toString('base64');
        const sha = response.data.sha; // Get the file's SHA

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
        console.error("Failed to update whitelist:", error.response ? error.response.data : error.message);
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

// Function to redeem a key with HWID
const redeemKeyWithHwid = async (product, userId, hwid) => {
    const whitelist = await getWhitelist();

    if (!whitelist[product]) {
        throw new Error('Product not found');
    }

    const productData = whitelist[product];

    // Check if the key exists and has an HWID assigned
    for (const key in productData.keys) {
        if (key === userId) {  // Check against user's key
            const keyData = productData.keys[key];
            if (keyData.hwid && keyData.hwid !== hwid) {
                return { status: 'error', message: 'HWID mismatch' }; // HWID is already set
            }

            // If HWID is not set, assign the current HWID
            productData.keys[key].hwid = hwid || 'NONE';
            await updateWhitelist(whitelist);
            return { status: 'success', message: 'Key redeemed successfully', hwid: productData.keys[key].hwid };
        }
    }

    return { status: 'error', message: 'Key not found or not owned by user' };
};

// Function to reset HWID for a key
const resetHwid = async (product, userId, key) => {
    const whitelist = await getWhitelist();

    if (!whitelist[product]) {
        throw new Error('Product not found');
    }

    const productData = whitelist[product];

    if (!productData.keys[key] || productData.keys[key].ownerId !== userId) {
        return { status: 'error', message: 'You do not have permission to reset HWID for this key' };
    }

    productData.keys[key].hwid = 'NONE'; // Reset HWID
    await updateWhitelist(whitelist);
    return { status: 'success', message: 'HWID has been reset for the key' };
};

// Main API handler function
export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { product, ownerId } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product]) {
                whitelist[product] = { ownerId: ownerId, keys: {} };
            }

            // Generate keys
            for (let i = 0; i < 20; i++) {
                const newKey = generateRandomKey();
                whitelist[product].keys[newKey] = { ownerId: ownerId, hwid: 'NONE' }; // HWID starts as NONE
            }

            await updateWhitelist(whitelist);
            return res.status(200).json({ status: 'success', message: 'Product created with keys' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to create product' });
        }
    } else if (req.method === 'PATCH') {
        const { product, key, userId, hwid } = req.body;

        try {
            const result = await redeemKeyWithHwid(product, userId, hwid);
            return res.status(result.status === 'success' ? 200 : 403).json(result);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to redeem key' });
        }
    } else if (req.method === 'PUT') {
        const { product, key, userId } = req.body;

        try {
            const result = await resetHwid(product, userId, key);
            return res.status(result.status === 'success' ? 200 : 403).json(result);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to reset HWID' });
        }
    } else {
        return res.status(405).json({ error: 'Only POST, PATCH, and PUT requests are allowed' });
    }
}
