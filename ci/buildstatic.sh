#!/bin/bash
DST=staticbuild

rm -rf $DST
mkdir -p $DST

cp -r node_modules/@mercuryworkshop/bare-mux/dist/ $DST/baremux
cp -r node_modules/@mercuryworkshop/epoxy-transport/dist/ $DST/epoxy
cp -r node_modules/@mercuryworkshop/libcurl-transport/dist/ $DST/libcurl
cp -r assets/ $DST/assets
cp -r dist/ $DST/scram
cp -r static/* $DST

echo 'let _CONFIG = { wispurl: "wss://anura.pro/", bareurl: "https://aluu.xyz/bare/" }' > $DST/config.js
