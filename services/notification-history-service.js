/**
 * Notification History Service Module
 * Handles fetching and managing notification history data
 */

class NotificationHistoryService {
    /**
     * Get all notifications with optional filtering
     * @param {Object} pool - SQL connection pool
     * @param {Object} filters - Optional filters (status, dateFrom, dateTo, recipient, document)
     * @param {Object} options - Optional pagination and sorting
     * @returns {Object} - { notifications, total, page, pageSize }
     */
    async getNotifications(pool, filters = {}, options = {}) {
        const {
            status,
            dateFrom,
            dateTo,
            recipient,
            documentNumber,
            sentBy,
            notificationType
        } = filters;

        const {
            page = 1,
            pageSize = 50,
            sortBy = 'sent_at',
            sortOrder = 'DESC'
        } = options;

        const offset = (page - 1) * pageSize;

        // Build WHERE clause
        const conditions = [];
        const parameters = [];
        let paramIndex = 1;

        if (status) {
            conditions.push(`status = @param${paramIndex}`);
            parameters.push({ name: `param${paramIndex}`, value: status });
            paramIndex++;
        }

        if (notificationType) {
            conditions.push(`notification_type = @param${paramIndex}`);
            parameters.push({ name: `param${paramIndex}`, value: notificationType });
            paramIndex++;
        }

        if (dateFrom) {
            conditions.push(`sent_at >= @param${paramIndex}`);
            parameters.push({ name: `param${paramIndex}`, value: dateFrom });
            paramIndex++;
        }

        if (dateTo) {
            conditions.push(`sent_at <= @param${paramIndex}`);
            parameters.push({ name: `param${paramIndex}`, value: dateTo });
            paramIndex++;
        }

        if (recipient) {
            conditions.push(`(recipient_email LIKE @param${paramIndex} OR recipient_name LIKE @param${paramIndex})`);
            parameters.push({ name: `param${paramIndex}`, value: `%${recipient}%` });
            paramIndex++;
        }

        if (documentNumber) {
            conditions.push(`document_number LIKE @param${paramIndex}`);
            parameters.push({ name: `param${paramIndex}`, value: `%${documentNumber}%` });
            paramIndex++;
        }

        if (sentBy) {
            conditions.push(`(sent_by_email LIKE @param${paramIndex} OR sent_by_name LIKE @param${paramIndex})`);
            parameters.push({ name: `param${paramIndex}`, value: `%${sentBy}%` });
            paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Validate sortBy to prevent SQL injection
        const allowedSortColumns = ['sent_at', 'document_number', 'recipient_email', 'status', 'notification_type'];
        const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'sent_at';
        const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        try {
            // Get total count
            const countRequest = pool.request();
            parameters.forEach(param => {
                countRequest.input(param.name, param.value);
            });
            
            const countQuery = `
                SELECT COUNT(*) as total
                FROM Notifications
                ${whereClause}
            `;
            const countResult = await countRequest.query(countQuery);
            const total = countResult.recordset[0].total;

            // Get paginated data
            const dataRequest = pool.request();
            parameters.forEach(param => {
                dataRequest.input(param.name, param.value);
            });
            dataRequest.input('offset', offset);
            dataRequest.input('pageSize', pageSize);

            const dataQuery = `
                SELECT 
                    id,
                    document_number,
                    report_id,
                    recipient_user_id,
                    recipient_email,
                    recipient_name,
                    recipient_role,
                    notification_type,
                    email_subject,
                    sent_by_user_id,
                    sent_by_email,
                    sent_by_name,
                    status,
                    error_message,
                    sent_at,
                    read_at
                FROM Notifications
                ${whereClause}
                ORDER BY ${safeSortBy} ${safeSortOrder}
                OFFSET @offset ROWS
                FETCH NEXT @pageSize ROWS ONLY
            `;

            const dataResult = await dataRequest.query(dataQuery);

            return {
                notifications: dataResult.recordset,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            };

        } catch (error) {
            console.error('❌ [NOTIFICATION HISTORY] Error fetching notifications:', error);
            throw error;
        }
    }

    /**
     * Get notification statistics
     * @param {Object} pool - SQL connection pool
     * @returns {Object} - Statistics about notifications
     */
    async getStatistics(pool) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    COUNT(DISTINCT document_number) as unique_documents,
                    COUNT(DISTINCT recipient_email) as unique_recipients
                FROM Notifications
            `;

            const result = await pool.request().query(query);
            return result.recordset[0];

        } catch (error) {
            console.error('❌ [NOTIFICATION HISTORY] Error fetching statistics:', error);
            throw error;
        }
    }

    /**
     * Get recent notifications (last 24 hours)
     * @param {Object} pool - SQL connection pool
     * @param {number} limit - Number of notifications to return
     * @returns {Array} - Recent notifications
     */
    async getRecentNotifications(pool, limit = 10) {
        try {
            const query = `
                SELECT TOP ${limit}
                    id,
                    document_number,
                    recipient_email,
                    recipient_name,
                    status,
                    sent_at,
                    error_message
                FROM Notifications
                WHERE sent_at >= DATEADD(hour, -24, GETDATE())
                ORDER BY sent_at DESC
            `;

            const result = await pool.request().query(query);
            return result.recordset;

        } catch (error) {
            console.error('❌ [NOTIFICATION HISTORY] Error fetching recent notifications:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     * @param {Object} pool - SQL connection pool
     * @param {number} notificationId - Notification ID
     * @returns {boolean} - Success status
     */
    async markAsRead(pool, notificationId) {
        try {
            const query = `
                UPDATE Notifications
                SET read_at = GETDATE()
                WHERE id = @notificationId AND read_at IS NULL
            `;

            await pool.request()
                .input('notificationId', notificationId)
                .query(query);

            return true;

        } catch (error) {
            console.error('❌ [NOTIFICATION HISTORY] Error marking notification as read:', error);
            throw error;
        }
    }
}

module.exports = NotificationHistoryService;
