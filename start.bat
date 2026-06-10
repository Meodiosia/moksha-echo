@echo off
echo 启动游戏服务器...
echo 浏览器访问: http://localhost:8765
start "" "http://localhost:8765"
python -m http.server 8765 --directory "%~dp0"
