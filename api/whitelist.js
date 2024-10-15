import axios from 'axios';
import { Buffer } from 'buffer'; // Explicit import to avoid buffer issues on Vercel

const REPO_OWNER = 'NewWhitelistService'; // Your GitHub username
const REPO_NAME = 'NewWhitelistService.github.io'; // Your repository name
const FILE_PATH = 'whitelist.json'; // The path to your whitelist file

const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Use GitHub token from environment variables

if (!GITHUB_TOKEN) {
    throw new Error("Missing GitHub token. Make sure it's set in the environment variables.");
}

// Helper to handle CORS (optional if you're calling this API from a client-side app)
import Cors from 'cors';

const cors = Cors({
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

// Function to fetch the whitelist.json file
const getWhitelist = async () => {
    try {
        console.log("Fetching whitelist...");
        const response = await axios.get(GITHUB_API_URL, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            },
        });
        console.log("GitHub API Response:", response.data);
        const content = Buffer.from(response.data.content, 'base64').toString();
        return JSON.parse(content);
    } catch (error) {
        console.error("Failed to fetch whitelist:", error.toJSON ? error.toJSON() : error.message);
        throw error;
    }
};

// Function to update the whitelist.json file
const updateWhitelist = async (newWhitelist) => {
    try {
        console.log("Fetching current SHA...");
        const response = await axios.get(GITHUB_API_URL, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            },
        });

        const newContent = Buffer.from(JSON.stringify(newWhitelist, null, 2)).toString('base64');
        const sha = response.data.sha;

        console.log("Updating whitelist with new SHA:", sha);

        await axios.put(GITHUB_API_URL, {
            message: 'Update whitelist',
            content: newContent,
            sha: sha,
            branch: 'main', // Adjust if using another branch
        }, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
            },
        });
    } catch (error) {
        console.error("Failed to update whitelist:", error.toJSON ? error.toJSON() : error.message);
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
    await runMiddleware(req, res, cors); // Handle CORS

    console.log("Received request:", req.method);

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

            if (!whitelist[product] || whitelist[product].ownerId !== userId) {
                return res.status(403).json({ status: 'error', message: 'You do not have permission to create a key for this product' });
            }

            const newKey = generateRandomKey();
            whitelist[product].keys[newKey] = 'NOT_SET';
            await updateWhitelist(whitelist);

            return res.status(200).json({ status: 'success', message: 'Key created', key: newKey });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to update whitelist' });
        }
    } else if (req.method === 'DELETE') {
        const { product, key, userId } = req.body;

        try {
            const whitelist = await getWhitelist();

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
                    whitelist[product].keys[key] = userId;
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
