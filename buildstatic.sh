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

