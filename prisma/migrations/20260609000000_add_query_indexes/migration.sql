-- Query-path indexes for admin list views, finance, reports, and drive browsing.
CREATE INDEX "project_status_created_idx" ON "Project"("status", "createdAt");
CREATE INDEX "project_client_status_created_idx" ON "Project"("clientId", "status", "createdAt");

CREATE INDEX "task_status_due_created_idx" ON "Task"("status", "dueDate", "createdAt");
CREATE INDEX "task_project_status_due_idx" ON "Task"("projectId", "status", "dueDate");

CREATE INDEX "receivable_status_due_created_idx" ON "Receivable"("status", "dueDate", "createdAt");
CREATE INDEX "receivable_client_status_due_idx" ON "Receivable"("clientId", "status", "dueDate");
CREATE INDEX "receivable_project_status_created_idx" ON "Receivable"("projectId", "status", "createdAt");
CREATE INDEX "receivable_invoice_status_idx" ON "Receivable"("invoiceId", "status");

CREATE INDEX "payment_paid_receivable_idx" ON "Payment"("paidAt", "receivableId");

CREATE INDEX "invoice_status_created_idx" ON "Invoice"("status", "createdAt");
CREATE INDEX "invoice_client_created_idx" ON "Invoice"("clientId", "createdAt");
CREATE INDEX "invoice_issue_status_idx" ON "Invoice"("issueDate", "status");

CREATE INDEX "drive_folder_client_parent_name_idx" ON "DriveFolder"("clientId", "parentId", "name");
CREATE INDEX "drive_folder_project_parent_name_idx" ON "DriveFolder"("projectId", "parentId", "name");

CREATE INDEX "drive_file_folder_name_idx" ON "DriveFile"("folderId", "name");
CREATE INDEX "drive_file_client_folder_name_idx" ON "DriveFile"("clientId", "folderId", "name");
CREATE INDEX "drive_file_project_folder_name_idx" ON "DriveFile"("projectId", "folderId", "name");

CREATE INDEX "credential_updated_idx" ON "Credential"("updatedAt");
CREATE INDEX "credential_client_updated_idx" ON "Credential"("clientId", "updatedAt");
CREATE INDEX "credential_project_updated_idx" ON "Credential"("projectId", "updatedAt");
