# Notification System Design

#### Stage 1: REST API Design & Real-time Mechanism

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



#### Stage 2: Persistent Storage & Schema Design

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



#### Stage 3: Query Performance & Optimization

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

---

#### Stage 4: DB Overload on Notification Fetch

## The Problem
If 50,000 students load a page, they each send out a new SELECT request to retrieve notifications. The DB connection pool runs out of resources, latency increases and it all falls apart. The problem at hand: Data is being queried again and again which has not changed.
## Solutions
1. Redis Caching
Cache each student's notifications when first loaded. Subsequent loads hit Redis, not the DB.
We have sub-millisecond reads, DB load is reduced significantly but at the same time we have the problem of — Cache invalidation is not so easy — every write requires a sync of the cache as well.
2. WebSockets 
Already proposed in Stage 1. Tell me at start-up whether or not the notification is on; push deltas to me from the server. There are no DB calls needed for page navigation.
Avoids the fetch-on-load pattern completely.but 50k open socket connections take up a lot of memory. Requires Redis pub/sub for scaling across multiple instances of Redis.
3. Read Replicas
Send all SELECT statements to the read replicas, and maintain writes on the primary.
The capacity is measured upward from the bottom, so you can use the horizontal scale to read the capacity, and this does not require any changes to the code; however, Replication lag — a student who marks a notification as read may, for a short time, see it as unread again on the next load, due to the horizontal scale.

### Conclusion
The ideal solution is to use all three: Redis for most reads, WebSockets for live updates meaning that the frontend never has to re-fetch, read replicas for misses in Redis's cache. The primary DB becomes read-only in steady state and that's because it should be, since it's the only one accessible to write operations.

---

#### Stage 5: High-Volume Notifications (Notify All)

## Shortcomings of the Proposed Implementation
1. Synchronous & Blocking. For loop executes sequentially on the server thread that is handling the HR's request. Taking many minutes to process 50,000 students means that the HTTP request will time out, and the HR won't know what happened.
2. No Fault Tolerance, Resumability. If the process crashes or the email API fails at student ERROR 200, then the remaining 49,800 students get nothing. Most importantly, no state tracking is done — rerunning the function would involve sending duplicate notifications to the first 200 students, but wouldn't ensure that they are completed.
3. Database Contention. During the broadcast, 50,000 individual INSERT statements in a tight loop will fill the DB connection pool, and negatively impact performance across the platform.
4. External API Rate Limits. If 50,000 email API calls are made without any throttling, they'll reach the rate limits or be classified as spam on the sender's domain.

What you can do with failed emails? 
With the original version, the answer is: No clean recovery will be possible. You do not know who passed or failed, so you will need to re-send to all 50,000 (which causes duplication) or you will lose the 200. This is the fundamental problem with a synchronous and stateless design.The solution is to keep a record of the delivery state per student per channel in the DB prior to attempting delivery, and then match up the failures with that record.
The notifications table holds all notifications that are not expired.The notifications table contains all notifications that are not expired, with the information: (student_id, channel, status, retried_at, attempt_count)
statuses: pending -> sent | failed
This allows re-running to be safe and idempotent, only rerunning on rows that are 'failed' and have an attempt_count less than MAX_RETRIES.
If DB Saving and Email Sending occur simultaneously?
No — they need to be separated, on two separate grounds:
Latency mismatch. A DB INSERT takes ~2ms. It takes 200-500ms to make an external email API call. When they are coupled, they are used to slow down the operation gates everything. This difference is 25 seconds at 50,000 students vs ~7 hours for sequential execution.Independent failure domains. If there is a problem with the email provider, it should not be fatal to in-app notifications or to persisting the notification record. Failure or success should be independent for each delivery channel. The email delivery is a byproduct of the source of truth being the DB write.
The cartridge is now re-designed to be fan-out, and it is asynchronous, with the input being a queue.

The redesign will involve three steps:
Instant API acknowledgment — the endpoint pushes batches to a queue and immediately returns a response that contains 202 Accepted.
Execute batch workers — receive messages from queue, process them and push to WebSocket in parallel.
Per student email queue — failures in the email API will not impact the DB or WebSocket layers because of separating email into its own queue. Persistent failures are handled by retries that back off exponentially and use a Dead Letter Queue.

### Pseudocode

```python

function notify_all_api(student_ids: array, message: string) -> HTTP 202:
    job_id = generate_uuid()
    create_broadcast_job(job_id, total=len(student_ids), status="in_progress")
    for chunk in split_into_chunks(student_ids, BATCH_SIZE):
        MessageQueue.publish("notification_batch_queue", {
            job_id:  job_id,
            ids:     chunk,
            message: message
        })
    return { job_id: job_id, status: "broadcast_initiated" }

function process_notification_batch(task):
    ids     = task.ids
    message = task.message
    job_id  = task.job_id
    bulk_upsert_notifications(ids, job_id, message, status="pending")
    active_ids = filter_active_sessions(ids)
    bulk_push_to_websocket(active_ids, message)
    for student_id in ids:
        MessageQueue.publish("email_job_queue", {
            student_id: student_id,
            job_id:     job_id,
            message:    message,
            attempt:    1
        })
    update_broadcast_job_progress(job_id, processed=len(ids))

function process_email_job(task):
    try:
        send_email(task.student_id, task.message)
        mark_notification(task.student_id, task.job_id, channel="email", status="sent")

    except EmailAPIError as e:
        if task.attempt < MAX_RETRIES:
            delay = BACKOFF_BASE ** task.attempt     # 2s, 4s, 8s
            MessageQueue.publish_delayed("email_job_queue", {
                ...task,
                attempt: task.attempt + 1
            }, delay_seconds=delay)
        else:
            mark_notification(task.student_id, task.job_id, channel="email", status="failed")
            DeadLetterQueue.publish("email_dlq", {
                student_id: task.student_id,
                job_id:     task.job_id,
                error:      e.message,
                final_attempt: task.attempt
            })

function process_dlq_entry(entry):
    log_failed_delivery(entry)
    alert_ops_team(entry)

```
