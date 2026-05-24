#!/bin/bash
set -e

npm install
# db:push is skipped — this project uses MS SQL Server directly (not Drizzle migrations)
