#!/bin/sh
# Mean absolute difference between consecutive 60 fps frames (downscaled), then
# flag single-frame pops: a difference 3x higher than both neighbours.
V=${1:-irly-film-silent.mp4}
ffmpeg -loglevel error -i "$V" -vf "scale=180:180,format=gray" -f rawvideo - | python3 -c "
import sys
d=sys.stdin.buffer.read(); n=180*180; fr=[d[i:i+n] for i in range(0,len(d)-n+1,n)]
diff=[0]+[sum(abs(a-b) for a,b in zip(fr[i],fr[i-1]))/n for i in range(1,len(fr))]
pops=[(i,round(diff[i],2)) for i in range(2,len(diff)-1) if diff[i]>3*max(diff[i-1],diff[i+1],0.4)]
print('frames',len(fr)); print('pops',[(i, round(i/60*2,2), v) for i,v in pops])
"
