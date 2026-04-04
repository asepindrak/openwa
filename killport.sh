pkill -f node || npx kill-port 55111 || kill -9 $(lsof -t -i:55111)
pkill -f node || npx kill-port 55222 || kill -9 $(lsof -t -i:55222)