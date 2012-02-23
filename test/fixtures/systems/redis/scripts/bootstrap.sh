mkdir -p /etc/redis/
awk -v var='{{ passArg }}' '{  gsub(/{{ password }}/,var,$0); print  }' redis.conf > /etc/redis/redis.conf

http://redis.googlecode.com/files/redis-2.4.1.tar.gz | tar -xz
cd redis-2.4.1
make
make PREFIX=/usr install

cp /root/init.d.redis /etc/init.d/redis-server
chmod +x /etc/init.d/redis-server
useradd redis || true
mkdir -p /var/lib/redis
mkdir -p /var/log/redis
chown redis.redis /var/lib/redis
chown redis.redis /var/log/redis
cd /root
