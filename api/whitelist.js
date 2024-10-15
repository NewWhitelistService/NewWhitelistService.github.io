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
        const sha = response.data.sha;

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

// Function to create a new product with an API key, owner ID, and guild ID
const createProduct = async (productName) => {
    const whitelist = await getWhitelist();

    if (!whitelist[productName]) {
        whitelist[productName] = {
            apiKey: generateRandomKey(), // Generate and assign a new API key
            ownerId: null,
            guildId: null,
            keys: {}
        };
        await updateWhitelist(whitelist);
        return { status: 'success', apiKey: whitelist[productName].apiKey };
    } else {
        return { status: 'error', message: `Product ${productName} already exists.` };
    }
};

// Function to set the owner and guild ID for a product based on the API key
const setApiKey = async (apiKey, userId, guildId) => {
    const whitelist = await getWhitelist();

    // Find the product based on the provided API key
    const product = Object.values(whitelist).find(item => item.apiKey === apiKey);

    // Check if the product exists
    if (product) {
        // Assign the user as the owner and set the guild ID if the owner is currently null
        if (product.ownerId === null) {
            product.ownerId = userId; // Assign the current user as the owner
            product.guildId = guildId; // Assign the current guild ID
            await updateWhitelist(whitelist);
            return { status: 'success', message: 'Owner and guild ID assigned successfully.' };
        } else {
            return { status: 'error', message: 'Product already has an owner.' };
        }
    } else {
        return { status: 'error', message: 'Product does not exist.' };
    }
};

// Function to create a key for a product
const createKey = async (productName, userId) => {
    const whitelist = await getWhitelist();

    if (whitelist[productName]) {
        if (whitelist[productName].ownerId === userId) { // Check if the user is the owner
            const newKey = generateRandomKey();
            whitelist[productName].keys[newKey] = {
                hwid: null,
                claimedBy: null
            };
            await updateWhitelist(whitelist);
            return { status: 'success', key: newKey };
        } else {
            return { status: 'error', message: 'Only the owner can create keys for this product.' };
        }
    } else {
        return { status: 'error', message: 'Product does not exist.' };
    }
};

// Function to redeem a key
const redeemKey = async (productName, key, userId) => {
    const whitelist = await getWhitelist();

    if (whitelist[productName] && whitelist[productName].keys[key]) {
        const keyInfo = whitelist[productName].keys[key];

        if (!keyInfo.claimedBy) {
            keyInfo.claimedBy = userId; // Link key with the user
            await updateWhitelist(whitelist);
            return { status: 'success', message: 'Key redeemed successfully.' };
        } else {
            return { status: 'error', message: 'This key has already been claimed.' };
        }
    } else {
        return { status: 'error', message: 'Invalid product or key.' };
    }
};

// Function to reset HWID
const resetHwid = async (productName, key, userId) => {
    const whitelist = await getWhitelist();

    if (whitelist[productName] && whitelist[productName].keys[key]) {
        const keyInfo = whitelist[productName].keys[key];

        if (keyInfo.claimedBy === userId) {
            keyInfo.hwid = null; // Reset HWID
            await updateWhitelist(whitelist);
            return { status: 'success', message: 'HWID has been reset.' };
        } else {
            return { status: 'error', message: 'You do not have permission to reset HWID for this key.' };
        }
    } else {
        return { status: 'error', message: 'Invalid product or key.' };
    }
};

// Main handler
export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, productName, ownerId, guildId, userId, key, apiKey } = req.body;

        try {
            if (action === 'createProduct') {
                const result = await createProduct(productName);
                return res.status(200).json(result);
            } else if (action === 'setApiKey') {
                const result = await setApiKey(apiKey, userId, guildId);
                return res.status(200).json(result);
            } else if (action === 'createKey') {
                const result = await createKey(productName, userId);
                return res.status(200).json(result);
            } else if (action === 'redeemKey') {
                const result = await redeemKey(productName, key, userId);
                return res.status(200).json(result);
            } else if (action === 'resetHwid') {
                const result = await resetHwid(productName, key, userId);
                return res.status(200).json(result);
            } else {
                return res.status(400).json({ status: 'error', message: 'Invalid action.' });
            }
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    } else {
        return res.status(405).json({ error: 'Only POST requests are allowed' });
    }
}
