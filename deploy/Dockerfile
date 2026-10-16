# 构建镜像
FROM node:22-alpine

WORKDIR /app

# 复制项目文件
COPY . .

# 数据目录（挂载出来持久化）
VOLUME ["/app/data"]

ENV PORT=3000
ENV ADMIN_PASSWORD=admin123

EXPOSE 3000

CMD ["node", "server.js"]
