import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

class RedirectController {
    // GET /s/:shortCode - Redirect to user site
    async redirectToUserSite(req: Request, res: Response, next: NextFunction) {
        try {
            const { shortCode } = req.params;

            if (!shortCode) {
                return res.status(400).json({ error: 'Short code is required' });
            }

            // Find settings with this short code
            const settings = await prisma.settings.findFirst({
                where: { shortCode: shortCode },
                include: { users: true }
            });

            if (!settings || !settings.users) {
                return res.status(404).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>URL Not Found</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            h1 { color: #e74c3c; }
                        </style>
                    </head>
                    <body>
                        <h1>404 - URL Not Found</h1>
                        <p>The short URL you're looking for doesn't exist.</p>
                    </body>
                    </html>
                `);
            }

            // Get business name from user
            const businessName = settings.users.businessName;

            if (!businessName) {
                return res.status(404).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Business Not Found</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            h1 { color: #e74c3c; }
                        </style>
                    </head>
                    <body>
                        <h1>Business Not Found</h1>
                        <p>This business is not configured properly.</p>
                    </body>
                    </html>
                `);
            }

            // Construct the user site URL
            const userSiteUrl = process.env.USER_SITE_URL || 'https://wkuser.netlify.app';
            const sanitizedBusinessName = businessName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const redirectUrl = `${userSiteUrl}/${sanitizedBusinessName}/login`;

            // Redirect to the user site
            res.redirect(302, redirectUrl);

        } catch (error) {
            console.error('❌ Error in redirect:', error);
            next(error);
        }
    }
}

export default new RedirectController();