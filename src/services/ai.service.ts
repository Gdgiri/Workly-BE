import prisma from '../prisma';
import axios from 'axios';
import dashboardService from './dashboard.service';

class AIService {
    private async getGroqApiKey(adminId: string): Promise<string | null> {
        try {
            const settings = await prisma.settings.findUnique({
                where: { adminId }
            });

            if (!settings || !settings.apiIntegrations) return null;

            const integrations = typeof settings.apiIntegrations === 'string'
                ? JSON.parse(settings.apiIntegrations)
                : (settings.apiIntegrations as any);

            const groq = integrations.find((i: any) => i.enabled && i.apiKey?.startsWith('gsk_'));
            return groq ? groq.apiKey : null;
        } catch (error) {
            console.error('Error fetching Groq API key:', error);
            return null;
        }
    }

    async getChatResponse(adminId: string, messages: any[], currencySymbol: string = '$'): Promise<string> {
        const groqApiKey = await this.getGroqApiKey(adminId);

        if (!groqApiKey) {
            return "I apologize, but I couldn't find an active Groq API configuration for your business. Please check your settings.";
        }

        const latestStats = await dashboardService.getDashboardStats(adminId);
        const businessContext = this.generateBusinessContext(latestStats, currencySymbol);

        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(businessContext)
                    },
                    ...messages.slice(-5)
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error: any) {
            console.error('Groq API Error:', error.response?.data || error.message);
            return "I'm having trouble connecting to my brain right now. Please try again in a moment.";
        }
    }

    private generateBusinessContext(stats: any, symbol: string): string {
        if (!stats) return "";

        return `
        Available Metrics for Today (${new Date().toLocaleDateString()}):
        - Revenue: ${symbol}${stats.todayRevenue}
        - Schedule/Appointment Count: ${stats.todayAppointmentsCount || 0}
        - Completed Sales Count: ${stats.todaySalesCount || 0}
        - Total Unique Customers: ${stats.totalCustomers}
        - Lifetime Business Earnings: ${symbol}${stats.totalEarnings}
        - Lifetime Business Expenses: ${symbol}${stats.totalExpenses}
        - This Month's Expenses: ${symbol}${stats.thisMonthExpenses || 0}
        - Today's Expenses: ${symbol}${stats.todayExpensesSum || 0}
        - Today's Expense Breakdown:
${stats.todayExpenses?.map((e: any) => `          * ${e.title} (${e.category}): ${symbol}${e.amount}`).join('\n') || 'No expenses today'}
        - Today's Individual Sales Details:
${stats.todayServices?.map((s: any) => `          * ${s.customerName} (${symbol}${s.totalAmount})`).join('\n') || 'No sales today'}
        
        - Recent Monthly Transactions (Historical Context):
${stats.recentTransactions?.map((s: any) => `          * ${s.id.slice(-6)}: ${s.customerName} (${symbol}${s.totalAmount}) - ${new Date(s.createdAt).toLocaleDateString()}`).join('\n') || 'No recent transactions'}

        === MONTHLY BUSINESS REPORT (${new Date().toLocaleString('default', { month: 'long' })}) ===
        - Monthly Revenue: ${symbol}${stats.thisMonthRevenue || 0}
        - Monthly Transactions: ${stats.thisMonthSalesCount || 0}
        - Monthly Appointments: ${stats.thisMonthAppointmentsCount || 0}
        
        === CUSTOMER INTELLIGENCE ===
        - Top 5 Most Frequent Customers: ${stats.topCustomersByVisits?.map((c: any) => `${c.name} (${c.value} visits)`).join(', ') || 'N/A'}
        - Top 5 Highest Spenders: ${stats.topCustomersBySpend?.map((c: any) => `${c.name} (${symbol}${c.value})`).join(', ') || 'N/A'}

        === INVENTORY INTELLIGENCE ===
        - High Stock Items (>20 units): ${stats.highStockItems?.map((i: any) => `${i.name} (${i.stock})`).join(', ') || 'None'}
        - Most Expensive Items: ${stats.highPriceItems?.map((i: any) => `${i.name} (${symbol}${i.price})`).join(', ') || 'N/A'}
        - Least Expensive Items: ${stats.lowPriceItems?.map((i: any) => `${i.name} (${symbol}${i.price})`).join(', ') || 'N/A'}

        === OPERATIONS & STAFF ===
        - Available Specialists: ${stats.availableSpecialists?.map((s: any) => s.name).join(', ') || 'None listed'}
        - Daily Payment Reconciliation: ${Object.entries(stats.dailyReconciliation || {}).map(([method, amount]) => `${method}: ${symbol}${amount}`).join(', ') || 'No payments today'}
        - Monthly Payment Reconciliation: ${Object.entries(stats.monthlyReconciliation || {}).map(([method, amount]) => `${method}: ${symbol}${amount}`).join(', ') || 'No payments this month'}

        - PENDING Requests/Notifications: ${stats.pendingRequestsCount || 0}
        - Active Packages: ${stats.activePackages?.map((p: any) => `${p.name} (${symbol}${p.price})`).join(', ') || 'None available yet'}
        - Top Performing Services (Last 30 Days): ${stats.topServices?.map((s: any) => `${s.name} (${s.value} times)`).join(', ') || 'Data pending'}
        - Top Performing Specialists (Last 30 Days): ${stats.topStylists?.map((s: any) => `${s.name} (${s.value} bookings)`).join(', ') || 'No data yet'}
        - Low Stock Inventory Alerts: ${stats.lowStockAlerts?.map((i: any) => `${i.name} (Only ${i.stock} left)`).join(', ') || 'All stock levels healthy'}

        === INVENTORY MOVEMENTS (RECENT) ===
${stats.inventoryMovements?.map((m: any) => `          * ${new Date(m.date).toLocaleDateString()}: ${m.product} - ${m.type} (${m.quantity}) -> New Balance: ${m.balanceAfter}`).join('\n') || 'No recent movements'}

        === VOUCHERS & REDEMPTIONS ===
        - Total Vouchers: ${stats.vouchersStatus?.totalCount || 0}
        - Active Vouchers: ${stats.vouchersStatus?.activeCount || 0}
        - Unredeemed Balance: ${symbol}${stats.vouchersStatus?.totalRedeemableBalance || 0}
        - Active Claims: ${stats.vouchersStatus?.activeClaimsCount || 0}
        - Active Customer Packages: ${stats.customerPackagesDetail?.length || 0}

        === CASHIER SUMMARY (TODAY) ===
${stats.cashierSummary?.map((c: any) => `          * ${c.name}: ${symbol}${c.amount}`).join('\n') || 'No cashier activity today'}
        - Total Cashier Collection: ${symbol}${stats.todayRevenue || 0}

        - Individual Sales List (Today):
${stats.todayServices?.map((s: any) => `          * ID: ${s.id.slice(-6)} | Customer: ${s.customerName} | Total: ${symbol}${s.totalAmount} | Paid: ${symbol}${s.paidAmount} | Cashier: ${s.cashierName}`).join('\n') || 'No individual sales reported yet'}
        `;
    }

    private getSystemPrompt(businessContext: string): string {
        return `═╕ CORE IDENTITY ══════════════════════════════════════
You are an AI-powered PROFESSIONAL BUSINESS ASSISTANT.
• You are NOT a general chatbot—you are a BUSINESS OPERATIONS ASSISTANT.
• Always speak in a clear, confident, professional tone.
• Use the word "business" instead of "salon".
• Be concise, accurate, and actionable.

═╕ BUSINESS CONTEXT (REAL-TIME DATA) ══════════════════════
${businessContext}

Use this data EXACTLY when relevant to the user's question.
If exact data is not available, clearly state so.

═╕ RESPONSE RULES (MANDATORY) ════════════════════════════
1️⃣ DATA PRESENTATION (PRIORITY)
• **USE TABLES** for all lists of sales, expenses, and monthly reports.
• **CASHIER SUMMARY**: When asked for a cashier summary, use a table: | Cashier | Total Collected |. Sum up all entries to provide a "Total Collected" row at the bottom.
• For summaries (Revenue, Transactions, etc.), use a 2-column table: | Metric | Value |.
• For data lists, use appropriate columns: | ID | Customer | Amount | Date |.
• **DO NOT USE BULLET POINTS** for data that can be tabulated.
• Markdown table syntax is required.

2️⃣ ANSWER FIRST
• Start with the direct answer or acknowledgment.
• Be direct and authoritative.

3️⃣ DATA-DRIVEN
• Inject real numbers, names, and counts **ONLY when relevant**.
• **DO NOT** provide a full business report for simple greetings.
• Highlight key values using **bold** formatting.
• Use the currency symbol provided in the context.

4️⃣ ACTIONABLE GUIDANCE
• Explain what to do next inside the platform when applicable.
• For "how-to" questions, provide clear step-by-step numbered instructions.
• Reference exact menu locations and button names.

5️⃣ SECURITY & PRIVACY
• **NEVER** share data from one admin to another.
• Only use the data provided in the context above.
• If asked for data not in context, say you don't have access to that specific information yet.

6️⃣ ENGAGEMENT (SUGGESTIONS)
• At the end of EVERY response, suggest 2-3 brief "Suggested Next Questions" based on the context of the conversation.
• Format them as: "Suggested: [Question 1] | [Question 2]" or similar.
• **NEVER** say "No" to a business question if you can provide a related suggestion or partial insight.
══════════════════════════════════════════════════════════`;
    }
}

export const aiService = new AIService();
