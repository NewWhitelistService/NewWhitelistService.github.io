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
                Authorization: `token ${GITHUB_TOKEN}`, // Use the GitHub token for authorization
            },
        });
        const content = Buffer.from(response.data.content, 'base64').toString();
        return JSON.parse(content);
    } catch (error) {
        console.error("Failed to fetch whitelist:", error.message);
        throw error;
    }
};

// Function to update the whitelist.json file
const updateWhitelist = async (newWhitelist) => {
    try {
        // Fetch the current SHA of the file (needed to update)
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
            sha: sha, // Include the SHA when updating
        }, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
            },
        });
    } catch (error) {
        console.error("Failed to update whitelist:", error.message);
        throw error;
    }
};

// Function to generate a random key
const generateRandomKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 20; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
};

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const whitelist = await getWhitelist();
            return res.status(200).json(whitelist);
        } catch (error) {
            return res.status(500).json({ error: 'Failed to get whitelist' });
        }
    } else if (req.method === 'POST') {
        const { product, ownerId } = req.body;

        try {
            const whitelist = await getWhitelist();

            if (!whitelist[product]) {
                whitelist[product] = {
                    ownerId: ownerId,
                    keys: {}
                };
            }

            await updateWhitelist(whitelist);
            return res.status(200).json({ status: 'success', message: 'Product created' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update whitelist' });
        }
    } else if (req.method === 'PUT') {
        const { product, userId } = req.body;

        try {
            const whitelist = await getWhitelist();

            // Check if the user has permission to create a key for this product
            if (!whitelist[product] || whitelist[product].ownerId !== userId) {
                return res.status(403).json({ status: 'error', message: 'You do not have permission to create a key for this product' });
            }

            const newKey = generateRandomKey();
            whitelist[product].keys[newKey] = 'NOT_SET'; // Key created but HWID not set
            await updateWhitelist(whitelist);

            return res.status(200).json({ status: 'success', message: 'Key created', key: newKey });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update whitelist' });
        }
    } else if (req.method === 'DELETE') {
        const { product, key, userId } = req.body;

        try {
            const whitelist = await getWhitelist();

            // Check if the user has permission to delete this key
            if (!whitelist[product] || whitelist[product].ownerId !== userId) {
                return res.status(403).json({ status: 'error', message: 'You do not have permission to delete this key' });
            }

            if (whitelist[product] && whitelist[product].keys[key]) {
                delete whitelist[product].keys[key];
                await updateWhitelist(whitelist);
                return res.status(200).json({ status: 'success', message: 'Key removed from whitelist' });
            } else {
                return res.status(404).json({ status: 'error', message: 'Key not found' });
            }
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update whitelist' });
        }
    } else if (req.method === 'PATCH') {
        const { key, userId } = req.body;

        try {
            const whitelist = await getWhitelist();

            for (const product in whitelist) {
                if (whitelist[product].keys[key]) {
                    whitelist[product].keys[key] = userId; // Assign the buyer's ID to the key
                    await updateWhitelist(whitelist);
                    return res.status(200).json({ status: 'success', message: 'Key redeemed successfully' });
                }
            }

            return res.status(404).json({ status: 'error', message: 'Key not found' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to redeem key' });
        }
    }

    return res.status(405).json({ error: 'Only GET, POST, PUT, PATCH, and DELETE requests are allowed' });
}
