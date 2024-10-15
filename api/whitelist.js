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

// Function to create a new product with an API key
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
// Function to set API key and assign ownerId and guildId
const setApiKey = async (apiKey, userId, guildId) => {
    const whitelist = await getWhitelist();

    // Find product by API key
    const productName = Object.keys(whitelist).find(product => whitelist[product].apiKey === apiKey);

    if (productName) {
        // Check if the ownerId is already set
        if (whitelist[productName].ownerId) {
            return { status: 'error', message: 'Already has owner.' };
        }
        
        whitelist[productName].ownerId = userId; // Set the owner ID
        whitelist[productName].guildId = guildId; // Set the guild ID
        await updateWhitelist(whitelist);
        return { status: 'success', message: 'API key set successfully.' };
    } else {
        return { status: 'error', message: 'Invalid API key.' };
    }
};

// Function to create a key for a product based on guild ID
const createKey = async (userId, guildId) => {
    const whitelist = await getWhitelist();
    
    // Find the product associated with the guild ID
    const productName = Object.keys(whitelist).find(product => whitelist[product].guildId === guildId && whitelist[product].ownerId === userId);

    if (productName) {
        const newKey = generateRandomKey();
        whitelist[productName].keys[newKey] = {
            hwid: null,
            claimedBy: null
        };
        await updateWhitelist(whitelist);
        return { status: 'success', key: newKey };
    } else {
        return { status: 'error', message: 'Invalid product or key.' };
    }
};

// Function to reset HWID for a key found by guild ID
const resetHwid = async (guildId, userId) => {
    const whitelist = await getWhitelist();

    // Find the product associated with the guild ID
    const productName = Object.keys(whitelist).find(product => whitelist[product].guildId === guildId);

    if (productName) {
        const keys = whitelist[productName].keys;
        for (const key in keys) {
            if (keys[key].claimedBy === userId) {
                keys[key].hwid = null; // Reset HWID
                await updateWhitelist(whitelist);
                return { status: 'success', message: 'HWID has been reset.' };
            }
        }
        return { status: 'error', message: 'You do not have permission to reset HWID for this key.' };
    } else {
        return { status: 'error', message: 'Invalid product or key.' };
    }
};

// Function to check and set HWID for a key
const checkAndSetHwid = async (key, hwid, productName) => {
    const whitelist = await getWhitelist();

    // Check if the product exists in the whitelist
    if (whitelist[productName]) {
        const keys = whitelist[productName].keys;

        // Check if the specified key exists in the product's keys
        if (keys[key]) {
            // Check if the HWID for the key is null
            if (keys[key].hwid === null) {
                // Set the HWID
                keys[key].hwid = hwid; // Set the current HWID
                await updateWhitelist(whitelist);
                return { status: 'success' }; // Return success without message
            } else {
                // Compare the HWID with the current HWID in the whitelist
                if (keys[key].hwid === hwid) {
                    return { status: 'success' }; // Return success without message
                } else {
                    return { status: 'error' }; // HWID does not match
                }
            }
        } else {
            return { status: 'error' }; // Invalid key
        }
    } else {
        return { status: 'error' }; // Invalid product
    }
};

// Main API handler
export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, userId, guildId, key, apiKey, hwid, productName } = req.body;

        try {
            if (action === 'createProduct') {
                const result = await createProduct(apiKey); // apiKey is the product name
                return res.status(200).json(result);
            } else if (action === 'setApiKey') {
                const result = await setApiKey(apiKey, userId, guildId);
                return res.status(200).json(result);
            } else if (action === 'createKey') {
                const result = await createKey(userId, guildId);
                return res.status(200).json(result);
            } else if (action === 'resetHwid') {
                const result = await resetHwid(guildId, userId);
                return res.status(200).json(result);
            } else if (action === 'checkAndSetHwid') {
                const result = await checkAndSetHwid(key, hwid, productName);
                return res.status(200).json(result);
            } else {
                return res.status(400).json({ status: 'error', message: 'Invalid action.' });
            }
        } catch (error) {
            return res.status(500).json({ status: 'error', message: error.message });
        }
    } else {
        return res.status(405).json({ status: 'error', message: 'Only POST requests are allowed' });
    }
}
