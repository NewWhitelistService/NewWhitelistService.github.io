import axios from 'axios';
import crypto from 'crypto'; // Import crypto for API key generation

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

// Function to generate a random API key
const generateApiKey = () => {
    return crypto.randomBytes(16).toString('hex'); // Generates a 32-character hex string
};

// Function to get the product name by API key
const getProductByApiKey = async (apiKey) => {
    const whitelist = await getWhitelist();
    
    for (const productName in whitelist) {
        if (whitelist[productName].apiKey === apiKey) {
            return productName;
        }
    }
    
    return null; // Return null if the API key is not found
};

// Function to create a new product
const createProduct = async (productName, ownerId) => {
    const whitelist = await getWhitelist();
    
    if (!whitelist[productName]) {
        const apiKey = generateApiKey(); // Generate a new API key
        whitelist[productName] = {
            ownerId: ownerId,
            keys: {},
            apiKey: apiKey // Set the API key
        };
        await updateWhitelist(whitelist);
        return { 
            status: 'success', 
            message: `Product ${productName} created.`,
            APIKEY: apiKey // Return the generated API key
        };
    } else {
        return { status: 'error', message: `Product ${productName} already exists.` };
    }
};

// Function to set the API key for a product
const setApiKey = async (productName, apiKey) => {
    const whitelist = await getWhitelist();
    
    if (whitelist[productName]) {
        whitelist[productName].apiKey = apiKey; // Set the API key
        await updateWhitelist(whitelist);
        return { status: 'success', message: `API Key set for product ${productName}.` };
    } else {
        return { status: 'error', message: `Product ${productName} does not exist.` };
    }
};

// Function to create a random key
const generateRandomKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
};

// Function to create a key for a product
const createKey = async (productName) => {
    const whitelist = await getWhitelist();
    
    if (whitelist[productName]) {
        const newKey = generateRandomKey();
        whitelist[productName].keys[newKey] = {
            hwid: null,
            claimedBy: null,
            guilds: []
        };
        await updateWhitelist(whitelist);
        return { status: 'success', key: newKey };
    } else {
        return { status: 'error', message: `Product ${productName} does not exist.` };
    }
};

// Function to redeem a key
const redeemKey = async (productName, key, userId) => {
    const whitelist = await getWhitelist();

    if (whitelist[productName] && whitelist[productName].keys[key]) {
        if (!whitelist[productName].keys[key].claimedBy) {
            whitelist[productName].keys[key].claimedBy = userId; // Link key with the user
            await updateWhitelist(whitelist);
            return { status: 'success', message: 'Key redeemed successfully.' };
        } else {
            return { status: 'error', message: 'This key has already been claimed.' };
        }
    } else {
        return { status: 'error', message: 'Invalid product or key.' };
    }
};

// Function to check and set HWID for a key
const checkAndSetHwid = async (productName, key, hwid) => {
    const whitelist = await getWhitelist();

    // Check if the product and key exist
    if (whitelist[productName] && whitelist[productName].keys[key]) {
        const keyInfo = whitelist[productName].keys[key];

        // Check if the key has been claimed
        if (keyInfo.claimedBy) {
            // If HWID is already set, compare with the current HWID
            if (keyInfo.hwid) {
                if (keyInfo.hwid === hwid) {
                    return { status: 'success', message: 'HWID matches.' };
                } else {
                    return { status: 'error', message: 'HWID does not match. Access denied.' };
                }
            } else {
                // Set HWID if it's not set
                keyInfo.hwid = hwid;
                await updateWhitelist(whitelist);
                return { status: 'success', message: 'HWID has been set.' };
            }
        } else {
            return { status: 'error', message: 'Key must be redeemed before setting HWID.' };
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
        const { action, productName, userId, key, hwid, apiKey } = req.body;

        try {
            if (action === 'createProduct') {
                const result = await createProduct(productName, userId);
                return res.status(200).json(result);
            } else if (action === 'setApiKey') {
                const result = await setApiKey(productName, apiKey);
                return res.status(200).json(result);
            } else if (action === 'createKey') {
                const result = await createKey(productName);
                return res.status(200).json(result);
            } else if (action === 'redeemKey') {
                const result = await redeemKey(productName, key, userId);
                return res.status(200).json(result);
            } else if (action === 'checkAndSetHwid') {
                const result = await checkAndSetHwid(productName, key, hwid);
                return res.status(200).json(result);
            } else if (action === 'resetHwid') {
                const result = await resetHwid(productName, key, userId);
                return res.status(200).json(result);
            } else if (action === 'getProductByApiKey') {
                const result = await getProductByApiKey(apiKey);
                if (result) {
                    return res.status(200).json({ status: 'success', productName: result });
                } else {
                    return res.status(404).json({ status: 'error', message: 'API Key not found.' });
                }
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
