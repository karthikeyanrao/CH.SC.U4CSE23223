# Notification System Design

## Stage 1: REST API Design & Real-time Mechanism

### Core Actions
1. Fetch Notifications: Fetch a list of notifications (Placements, Events, Results) for the logged in user.
2. Flag a notification as 'Read': Change a notification status to 'read' after user has viewed it.
3. Unread Count: Get the number of unread notifications in the notification badge.

### REST API Endpoints

#### 1. GET /api/v1/notifications
- Retrieves all notifications for the authenticated student.
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>`
  - `Content-Type: application/json`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "notificationType": "Placement",
      "title": "New Job Opportunity: AffordMed",
      "message": "Software Engineer roles are now open.",
      "isRead": false,
      "createdAt": "2026-05-06T14:00:00Z"
    }
  ],
  "meta": {
    "unreadCount": 12
  }
}
```

#### 2. PATCH /api/v1/notifications/{id}/read
Marks a specific notification as read.
- **Headers**:
  - `Authorization: Bearer <JWT_TOKEN>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Notification marked as read",
  "updatedAt": "2026-05-06T14:15:00Z"
}
```

#### 3. GET /api/v1/notifications/summary
Returns a summary count of unread notifications categorized by type.
- **Response (200 OK)**:
```json
{
  "success": true,
  "summary": {
    "Placement": 5,
    "Result": 2,
    "Event": 5,
    "Total": 12
  }
}
```
## Real-time Notification Mechanism
We will use WebSockets with Socket.io to send students the updates immediately, without reloading.
When a new notification is created in the back end (e.g., HR clicks 'Notify All), the server will send a new_notification event to the socket room of the specific student.
The frontend listens for this event and updates the local state/UI immediately, giving a seamless "real-time" experience.
---



## Stage 2: Persistent Storage & Schema Design

### Database Selection
For this notification platform I recommend to use PostgreSQL (a relational database).
**Why PostgreSQL?**
1. Strict data integrity is required to make sure that no messages are lost or modified.
2. Structured Relationships: The data is very relational.
3. JSONB Support: PostgreSQL supports the ability to store unstructured data in a structured schema with JSONB columns.

### Database Schema
We require two main tables: students and notifications.

```sql
CREATE TABLE students (
    student_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_notifications_student_created ON notifications(student_id, created_at DESC);
```

### Challenges with Increasing Data Volume
Managing the growing volume of data poses significant challenges.Data growth is a challenge.
As the platform expands to a number of millions of notifications, a number of issues will emerge:
1. To retrieve a user's notifications, you need to scan a large table, which makes it slow.
2. Storage Costs & Table Bloat: The table will take up a lot of disk, making backup and maintenance operations (such as `VACUUM` in Postgres) slow and resource consuming.
3. Locking rows and slowing down concurrent operations in the database will be the result of write bottlenecks like notifying all 50,000 students.

### Proposed Solutions
1. Partition notifications table based on the time of insertion (created_at) into the table, e.g. partition monthly, so that active queries on the table are performed against a smaller data set.
2. Archiving Strategy: Transfer notifications older than 6 months to lower cost cold storage or a separate historical database.
Read Replicas: Send all read requests (to get notifications) to the replicas of the database, keeping the primary database for write operations only.


### Queries based on Stage 1 APIs

**1. Fetch Notifications (GET /api/v1/notifications)**
```sql
SELECT notification_id, notification_type, title, message, is_read, created_at
FROM notifications
WHERE student_id = $1
ORDER BY created_at DESC
LIMIT $4 OFFSET $2;
```

**2. Mark as Read (PATCH /api/v1/notifications/{id}/read)**
```sql
UPDATE notifications
SET is_read = TRUE
WHERE notification_id = $1 AND student_id = $2;
```

**3. Unread Count Summary (GET /api/v1/notifications/summary)**
```sql
SELECT notification_type, COUNT(*) as count
FROM notifications
WHERE student_id = $1 AND is_read = FALSE
GROUP BY notification_type;
```



## Stage 3: Query Performance & Optimization

### Query Analysis
The developer wrote the following query:
`SELECT * FROM notifications WHERE studentlD = l042 AND isRead = false ORDER BY createdAt DESC;`

### Is the query accurate?
Yes, logically correct but SELECT * fetches unnecessary large columns like message.
It is Slow because it need to read 50000 rows and to check the student 1042 message that have unread messages it will check the full table whuch have O(n) Time Complexitity and the In Memory Filesort - OrderBY createat with no index support & SELECT * — fetches all columns including large text fields

### What to change?
```sql
CREATE INDEX idx_student_unread_time 
ON notifications(student_id, is_read, created_at DESC);
```

Only use the necessary columns in the query. An O(N) full scan becomes an O(log N) B-tree lookup when the results are pre-sorted. Query time: seconds → milliseconds.

## Should you index every column?
I suggest as No . All indexes will need to be updated on each INSERT/UPDATE/DELETE, which will result in write slowdowns when sending the bulk data. The only thing that low cardinality columns like is_read (2 values) or notification_type (3 values) provide by themselves is a tiny bit of performance. Only indexes based on true query patterns.
Students notified with a Placement notification within the past 7 days

### Query to find all student who got placement notification 
```SQL
SELECT DISTINCT student_id FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= NOW() - INTERVAL 7 DAY;
notification_type accepts enum values: 'Event', 'Result', 'Placement'.
```

