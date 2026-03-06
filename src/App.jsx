import { useState, useRef, useEffect } from "react";
import { XPV, REV_THRESHOLD, getConfidence, fluencyColor, fluencyLabel, buildPrompt, todayKey, dayType, dayName } from './utils.js';

// ─────────────────────────────────────────────────────────────
// PROBLEM DATA (75 problems with optimal solutions)
// ─────────────────────────────────────────────────────────────
const P = [
  { id:1,  title:"Two Sum",                              cat:"Array",     diff:"Easy",   lc:1,   pat:"Hash Map",
    desc:`Given nums and target, return indices of two numbers that add to target.\n\nInput:  nums=[2,7,11,15], target=9\nOutput: [0,1]`,
    sol:`def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        diff = target - n\n        if diff in seen: return [seen[diff], i]\n        seen[n] = i`,
    note:"One-pass hash map. Check complement before inserting. O(n) time, O(n) space." },
  { id:2,  title:"Best Time to Buy & Sell Stock",        cat:"Array",     diff:"Easy",   lc:121, pat:"Sliding Window",
    desc:`prices[i] = price on day i. Buy before sell. Return max profit or 0.\n\nInput:  [7,1,5,3,6,4]\nOutput: 5`,
    sol:`def maxProfit(prices):\n    l, r = 0, 1\n    maxP = 0\n    while r < len(prices):\n        if prices[l] < prices[r]: maxP = max(maxP, prices[r]-prices[l])\n        else: l = r\n        r += 1\n    return maxP`,
    note:"Two pointer: left=buy, right=sell. Move l to r when prices[l]≥prices[r]. O(n)." },
  { id:3,  title:"Contains Duplicate",                   cat:"Array",     diff:"Easy",   lc:217, pat:"Hash Set",
    desc:`Return true if any value appears at least twice.\n\nInput:  [1,2,3,1]\nOutput: true`,
    sol:`def containsDuplicate(nums):\n    return len(nums) != len(set(nums))`,
    note:"Set deduplicates. Length mismatch → duplicate exists. O(n)." },
  { id:4,  title:"Product of Array Except Self",         cat:"Array",     diff:"Medium", lc:238, pat:"Prefix/Suffix",
    desc:`output[i] = product of all except nums[i]. No division. O(n).\n\nInput:  [1,2,3,4]\nOutput: [24,12,8,6]`,
    sol:`def productExceptSelf(nums):\n    res = [1]*len(nums)\n    pre = 1\n    for i in range(len(nums)): res[i]=pre; pre*=nums[i]\n    post = 1\n    for i in range(len(nums)-1,-1,-1): res[i]*=post; post*=nums[i]\n    return res`,
    note:"Two passes: prefix L→R, multiply postfix R→L. O(n) time, O(1) extra space." },
  { id:5,  title:"Maximum Subarray",                     cat:"Array",     diff:"Medium", lc:53,  pat:"Kadane's",
    desc:`Find contiguous subarray with largest sum.\n\nInput:  [-2,1,-3,4,-1,2,1,-5,4]\nOutput: 6`,
    sol:`def maxSubArray(nums):\n    best = cur = nums[0]\n    for n in nums[1:]:\n        cur = max(n, cur+n)\n        best = max(best, cur)\n    return best`,
    note:"Kadane's: extend or restart at each element. O(n), O(1)." },
  { id:6,  title:"Maximum Product Subarray",             cat:"Array",     diff:"Medium", lc:152, pat:"Dynamic Programming",
    desc:`Find contiguous subarray with largest product.\n\nInput:  [2,3,-2,4]\nOutput: 6`,
    sol:`def maxProduct(nums):\n    res = max(nums)\n    curMin = curMax = 1\n    for n in nums:\n        if n==0: curMin=curMax=1; continue\n        t = curMax*n\n        curMax = max(n*curMax,n*curMin,n)\n        curMin = min(t,n*curMin,n)\n        res = max(res,curMax)\n    return res`,
    note:"Track both max and min (neg×neg=pos). Reset on zero. O(n), O(1)." },
  { id:7,  title:"Find Min in Rotated Sorted Array",     cat:"Array",     diff:"Medium", lc:153, pat:"Binary Search",
    desc:`Find minimum in rotated sorted array. O(log n).\n\nInput:  [3,4,5,1,2]\nOutput: 1`,
    sol:`def findMin(nums):\n    l,r = 0,len(nums)-1\n    res = nums[0]\n    while l<=r:\n        if nums[l]<nums[r]: return min(res,nums[l])\n        m = (l+r)//2\n        res = min(res,nums[m])\n        if nums[m]>=nums[l]: l=m+1\n        else: r=m-1\n    return res`,
    note:"If mid≥left, min is in right half. O(log n)." },
  { id:8,  title:"Search in Rotated Sorted Array",       cat:"Array",     diff:"Medium", lc:33,  pat:"Binary Search",
    desc:`Search rotated sorted array. Return index or -1. O(log n).\n\nInput:  [4,5,6,7,0,1,2], target=0\nOutput: 4`,
    sol:`def search(nums, target):\n    l,r = 0,len(nums)-1\n    while l<=r:\n        m=(l+r)//2\n        if nums[m]==target: return m\n        if nums[l]<=nums[m]:\n            if target>nums[m] or target<nums[l]: l=m+1\n            else: r=m-1\n        else:\n            if target<nums[m] or target>nums[r]: r=m-1\n            else: l=m+1\n    return -1`,
    note:"One side always sorted. Check which, then narrow. O(log n)." },
  { id:9,  title:"3Sum",                                 cat:"Array",     diff:"Medium", lc:15,  pat:"Two Pointers",
    desc:`Return all unique triplets summing to 0.\n\nInput:  [-1,0,1,2,-1,-4]\nOutput: [[-1,-1,2],[-1,0,1]]`,
    sol:`def threeSum(nums):\n    res=[]; nums.sort()\n    for i,a in enumerate(nums):\n        if a>0: break\n        if i>0 and a==nums[i-1]: continue\n        l,r=i+1,len(nums)-1\n        while l<r:\n            s=a+nums[l]+nums[r]\n            if s>0: r-=1\n            elif s<0: l+=1\n            else:\n                res.append([a,nums[l],nums[r]]); l+=1\n                while nums[l]==nums[l-1] and l<r: l+=1\n    return res`,
    note:"Sort, fix one, two-pointer rest. Skip duplicates. O(n²)." },
  { id:10, title:"Container With Most Water",            cat:"Array",     diff:"Medium", lc:11,  pat:"Two Pointers",
    desc:`Find two lines forming container with most water.\n\nInput:  [1,8,6,2,5,4,8,3,7]\nOutput: 49`,
    sol:`def maxArea(h):\n    l,r=0,len(h)-1; water=0\n    while l<r:\n        water=max(water,min(h[l],h[r])*(r-l))\n        if h[l]<h[r]: l+=1\n        else: r-=1\n    return water`,
    note:"Move shorter line inward — moving taller can only reduce. O(n)." },
  { id:11, title:"Sum of Two Integers",                  cat:"Binary",    diff:"Medium", lc:371, pat:"Bit Manipulation",
    desc:`Calculate a+b without + or - operators.\n\nInput: a=1, b=2 → 3`,
    sol:`def getSum(a,b):\n    mask=0xFFFFFFFF\n    while b&mask:\n        carry=(a&b)<<1; a=a^b; b=carry\n    return a if b==0 else a&mask`,
    note:"XOR=add no carry, AND<<1=carry. Repeat until no carry. Mask for Python ints." },
  { id:12, title:"Number of 1 Bits",                    cat:"Binary",    diff:"Easy",   lc:191, pat:"Bit Manipulation",
    desc:`Count '1' bits (Hamming weight).\n\nInput: n=11 → 3`,
    sol:`def hammingWeight(n):\n    res=0\n    while n: n&=n-1; res+=1\n    return res`,
    note:"n&(n-1) clears lowest set bit. Count iterations. O(number of 1s)." },
  { id:13, title:"Counting Bits",                        cat:"Binary",    diff:"Easy",   lc:338, pat:"Dynamic Programming",
    desc:`ans[i] = count of 1s in binary of i, for i in [0,n].\n\nInput: n=5 → [0,1,1,2,1,2]`,
    sol:`def countBits(n):\n    dp=[0]*(n+1); off=1\n    for i in range(1,n+1):\n        if off*2==i: off=i\n        dp[i]=1+dp[i-off]\n    return dp`,
    note:"dp[i]=1+dp[i-MSB]. Offset tracks current power of 2. O(n)." },
  { id:14, title:"Missing Number",                       cat:"Binary",    diff:"Easy",   lc:268, pat:"Bit Manipulation",
    desc:`Array has n distinct nums in [0,n]. Find missing.\n\nInput: [3,0,1] → 2`,
    sol:`def missingNumber(nums):\n    res=len(nums)\n    for i,n in enumerate(nums): res^=i^n\n    return res`,
    note:"XOR all indices and values. Everything cancels except missing. O(n), O(1)." },
  { id:15, title:"Reverse Bits",                         cat:"Binary",    diff:"Easy",   lc:190, pat:"Bit Manipulation",
    desc:`Reverse bits of 32-bit unsigned integer.`,
    sol:`def reverseBits(n):\n    res=0\n    for i in range(32): res|=((n>>i)&1)<<(31-i)\n    return res`,
    note:"Extract each bit R→L, place L→R. 32 iterations. O(1)." },
  { id:16, title:"Climbing Stairs",                      cat:"DP",        diff:"Easy",   lc:70,  pat:"1-D DP",
    desc:`1 or 2 steps. Distinct ways to reach step n?\n\nInput: n=3 → 3`,
    sol:`def climbStairs(n):\n    a,b=1,1\n    for _ in range(n-1): a,b=b,a+b\n    return b`,
    note:"Fibonacci. ways(n)=ways(n-1)+ways(n-2). Two vars. O(n), O(1)." },
  { id:17, title:"Coin Change",                          cat:"DP",        diff:"Medium", lc:322, pat:"1-D DP",
    desc:`Fewest coins to make amount. -1 if impossible.\n\nInput: coins=[1,5,11], amount=15 → 3`,
    sol:`def coinChange(coins,amount):\n    dp=[float('inf')]*(amount+1); dp[0]=0\n    for a in range(1,amount+1):\n        for c in coins:\n            if a-c>=0: dp[a]=min(dp[a],1+dp[a-c])\n    return dp[amount] if dp[amount]!=float('inf') else -1`,
    note:"dp[a]=min coins for amount a. Build from 0 up. O(amount×coins)." },
  { id:18, title:"Longest Increasing Subsequence",       cat:"DP",        diff:"Medium", lc:300, pat:"1-D DP",
    desc:`Length of longest strictly increasing subsequence.\n\nInput: [10,9,2,5,3,7,101,18] → 4`,
    sol:`def lengthOfLIS(nums):\n    dp=[1]*len(nums)\n    for i in range(1,len(nums)):\n        for j in range(i):\n            if nums[j]<nums[i]: dp[i]=max(dp[i],dp[j]+1)\n    return max(dp)`,
    note:"dp[i]=LIS ending at i. O(n²). Binary search variant is O(n log n)." },
  { id:19, title:"Longest Common Subsequence",           cat:"DP",        diff:"Medium", lc:1143,pat:"2-D DP",
    desc:`LCS length of two strings.\n\nInput: 'abcde', 'ace' → 3`,
    sol:`def longestCommonSubsequence(t1,t2):\n    dp=[[0]*(len(t2)+1) for _ in range(len(t1)+1)]\n    for i in range(len(t1)-1,-1,-1):\n        for j in range(len(t2)-1,-1,-1):\n            if t1[i]==t2[j]: dp[i][j]=1+dp[i+1][j+1]\n            else: dp[i][j]=max(dp[i+1][j],dp[i][j+1])\n    return dp[0][0]`,
    note:"2D DP: match→diagonal+1, else→max(down,right). O(m×n)." },
  { id:20, title:"Word Break",                           cat:"DP",        diff:"Medium", lc:139, pat:"1-D DP",
    desc:`Can s be segmented into wordDict words?\n\nInput: 'leetcode', ['leet','code'] → true`,
    sol:`def wordBreak(s,wordDict):\n    dp=[False]*(len(s)+1); dp[len(s)]=True\n    for i in range(len(s)-1,-1,-1):\n        for w in wordDict:\n            if i+len(w)<=len(s) and s[i:i+len(w)]==w: dp[i]=dp[i+len(w)]\n            if dp[i]: break\n    return dp[0]`,
    note:"dp[i]=can segment s[i:]. Work backwards. O(n×W×w)." },
  { id:21, title:"Combination Sum IV",                   cat:"DP",        diff:"Medium", lc:377, pat:"1-D DP",
    desc:`Ordered combinations summing to target.\n\nInput: nums=[1,2,3], target=4 → 7`,
    sol:`def combinationSum4(nums,target):\n    dp={0:1}\n    for t in range(1,target+1): dp[t]=sum(dp.get(t-n,0) for n in nums)\n    return dp[target]`,
    note:"dp[t]=ways to make t. Order matters→loop amount outer. O(target×n)." },
  { id:22, title:"House Robber",                         cat:"DP",        diff:"Medium", lc:198, pat:"1-D DP",
    desc:`No adjacent houses. Max you can rob.\n\nInput: [2,7,9,3,1] → 12`,
    sol:`def rob(nums):\n    a,b=0,0\n    for n in nums: a,b=b,max(n+a,b)\n    return b`,
    note:"max(skip=b, take=n+a). Two vars. O(n), O(1)." },
  { id:23, title:"House Robber II",                      cat:"DP",        diff:"Medium", lc:213, pat:"1-D DP",
    desc:`Houses in a circle. Max you can rob.\n\nInput: [2,3,2] → 3`,
    sol:`def rob(nums):\n    def h(a):\n        r1=r2=0\n        for n in a: r1,r2=r2,max(n+r1,r2)\n        return r2\n    return max(nums[0],h(nums[:-1]),h(nums[1:]))`,
    note:"Run House Robber I twice: skip first, skip last. Take max. O(n)." },
  { id:24, title:"Decode Ways",                          cat:"DP",        diff:"Medium", lc:91,  pat:"1-D DP",
    desc:`A=1,...,Z=26. Count decoding ways.\n\nInput: '226' → 3`,
    sol:`def numDecodings(s):\n    dp={len(s):1}\n    def f(i):\n        if i in dp: return dp[i]\n        if s[i]=='0': return 0\n        r=f(i+1)\n        if i+1<len(s) and (s[i]=='1' or s[i]=='2' and s[i+1]<'7'): r+=f(i+2)\n        dp[i]=r; return r\n    return f(0)`,
    note:"Memoized DFS. Single (if !=0) or two digits (10-26). O(n)." },
  { id:25, title:"Unique Paths",                         cat:"DP",        diff:"Medium", lc:62,  pat:"2-D DP",
    desc:`Robot right/down only. Unique paths in m×n grid.\n\nInput: m=3, n=7 → 28`,
    sol:`def uniquePaths(m,n):\n    row=[1]*n\n    for _ in range(m-1):\n        nr=[1]*n\n        for j in range(n-2,-1,-1): nr[j]=nr[j+1]+row[j]\n        row=nr\n    return row[0]`,
    note:"Bottom row=1s. Each cell=right+below. One row at a time. O(m×n), O(n)." },
  { id:26, title:"Jump Game",                            cat:"DP",        diff:"Medium", lc:55,  pat:"Greedy",
    desc:`nums[i]=max jump. Can you reach last index?\n\nInput: [2,3,1,1,4] → true`,
    sol:`def canJump(nums):\n    goal=len(nums)-1\n    for i in range(len(nums)-2,-1,-1):\n        if i+nums[i]>=goal: goal=i\n    return goal==0`,
    note:"Work backwards. Shift goal when reachable. O(n), O(1)." },
  { id:27, title:"Clone Graph",                          cat:"Graph",     diff:"Medium", lc:133, pat:"DFS + Hash Map",
    desc:`Deep clone connected undirected graph. Each node: val + neighbors.`,
    sol:`def cloneGraph(node):\n    m={}\n    def dfs(n):\n        if n in m: return m[n]\n        c=Node(n.val); m[n]=c\n        for nei in n.neighbors: c.neighbors.append(dfs(nei))\n        return c\n    return dfs(node) if node else None`,
    note:"DFS with old→new map. Store clone before recursing to handle cycles. O(V+E)." },
  { id:28, title:"Course Schedule",                      cat:"Graph",     diff:"Medium", lc:207, pat:"Topological Sort",
    desc:`Can you finish all courses given prerequisites?\n\nInput: n=2, pre=[[1,0]] → true`,
    sol:`def canFinish(n,pre):\n    adj=[[] for _ in range(n)]\n    for a,b in pre: adj[a].append(b)\n    vis={}\n    def dfs(c):\n        if c in vis: return vis[c]\n        vis[c]=True\n        for p in adj[c]:\n            if dfs(p): return True\n        vis[c]=False; adj[c]=[]\n        return False\n    return not any(dfs(c) for c in range(n))`,
    note:"DFS cycle detection. vis[c]=True means in current path. O(V+E)." },
  { id:29, title:"Pacific Atlantic Water Flow",          cat:"Graph",     diff:"Medium", lc:417, pat:"Multi-source DFS",
    desc:`Find cells where water flows to BOTH oceans.`,
    sol:`def pacificAtlantic(h):\n    R,C=len(h),len(h[0]); pac=set(); atl=set()\n    def dfs(r,c,vis,prev):\n        if (r,c) in vis or r<0 or c<0 or r==R or c==C or h[r][c]<prev: return\n        vis.add((r,c))\n        for dr,dc in[(1,0),(-1,0),(0,1),(0,-1)]: dfs(r+dr,c+dc,vis,h[r][c])\n    for r in range(R): dfs(r,0,pac,h[r][0]); dfs(r,C-1,atl,h[r][C-1])\n    for c in range(C): dfs(0,c,pac,h[0][c]); dfs(R-1,c,atl,h[R-1][c])\n    return [[r,c] for r in range(R) for c in range(C) if (r,c) in pac and (r,c) in atl]`,
    note:"Flood inward from borders (reversed ≥). Intersection=answer. O(m×n)." },
  { id:30, title:"Number of Islands",                    cat:"Graph",     diff:"Medium", lc:200, pat:"BFS/DFS",
    desc:`Count connected '1' regions in 2D grid.\n\nInput: [['1','1','0'],['0','1','0'],['0','0','1']] → 2`,
    sol:`def numIslands(grid):\n    R,C=len(grid),len(grid[0]); vis=set(); cnt=0\n    def bfs(r,c):\n        q=[(r,c)]; vis.add((r,c))\n        while q:\n            r,c=q.pop()\n            for dr,dc in[(1,0),(-1,0),(0,1),(0,-1)]:\n                nr,nc=r+dr,c+dc\n                if 0<=nr<R and 0<=nc<C and grid[nr][nc]=='1' and (nr,nc) not in vis:\n                    vis.add((nr,nc)); q.append((nr,nc))\n    for r in range(R):\n        for c in range(C):\n            if grid[r][c]=='1' and (r,c) not in vis: bfs(r,c); cnt+=1\n    return cnt`,
    note:"BFS from each unvisited '1'. Count BFS calls. O(m×n)." },
  { id:31, title:"Longest Consecutive Sequence",         cat:"Graph",     diff:"Medium", lc:128, pat:"Hash Set",
    desc:`Longest consecutive sequence. O(n) required.\n\nInput: [100,4,200,1,3,2] → 4`,
    sol:`def longestConsecutive(nums):\n    s=set(nums); best=0\n    for n in s:\n        if n-1 not in s:\n            l=1\n            while n+l in s: l+=1\n            best=max(best,l)\n    return best`,
    note:"Only count from sequence starts (n-1 not in set). O(n) amortized." },
  { id:32, title:"Alien Dictionary",                     cat:"Graph",     diff:"Hard",   lc:269, pat:"Topological Sort",
    desc:`Character ordering from sorted alien words.\n\nInput: ['wrt','wrf','er','ett','rftt'] → 'wertf'`,
    sol:`def alienOrder(words):\n    adj={c:set() for w in words for c in w}\n    for i in range(len(words)-1):\n        w1,w2=words[i],words[i+1]; mn=min(len(w1),len(w2))\n        if len(w1)>len(w2) and w1[:mn]==w2[:mn]: return ''\n        for j in range(mn):\n            if w1[j]!=w2[j]: adj[w1[j]].add(w2[j]); break\n    vis={}; res=[]\n    def dfs(c):\n        if c in vis: return vis[c]\n        vis[c]=True\n        for n in adj[c]:\n            if dfs(n): return True\n        vis[c]=False; res.append(c)\n    for c in adj:\n        if dfs(c): return ''\n    return ''.join(reversed(res))`,
    note:"Build graph from adjacent word pairs. DFS topo sort. O(C+E)." },
  { id:33, title:"Graph Valid Tree",                     cat:"Graph",     diff:"Medium", lc:261, pat:"Union Find",
    desc:`n nodes, edges. Is it a valid tree?\n\nInput: n=5, edges=[[0,1],[0,2],[0,3],[1,4]] → true`,
    sol:`def validTree(n,edges):\n    if len(edges)!=n-1: return False\n    adj=[[] for _ in range(n)]\n    for a,b in edges: adj[a].append(b); adj[b].append(a)\n    vis=set()\n    def dfs(v,p):\n        if v in vis: return False\n        vis.add(v)\n        return all(dfs(u,v) for u in adj[v] if u!=p)\n    return dfs(0,-1) and len(vis)==n`,
    note:"Tree = n-1 edges + connected + no cycles. Check count first. O(V+E)." },
  { id:34, title:"Number of Connected Components",       cat:"Graph",     diff:"Medium", lc:323, pat:"Union Find",
    desc:`n nodes, undirected edges. Count components.\n\nInput: n=5, edges=[[0,1],[1,2],[3,4]] → 2`,
    sol:`def countComponents(n,edges):\n    p=list(range(n)); r=[1]*n\n    def find(x):\n        while x!=p[x]: p[x]=p[p[x]]; x=p[x]\n        return x\n    def union(a,b):\n        a,b=find(a),find(b)\n        if a==b: return 0\n        if r[b]>r[a]: a,b=b,a\n        p[b]=a; r[a]+=r[b]; return 1\n    return n-sum(union(a,b) for a,b in edges)`,
    note:"Union-Find with path compression. Each union reduces count by 1. O(n·α(n))." },
  { id:35, title:"Insert Interval",                      cat:"Interval",  diff:"Medium", lc:57,  pat:"Intervals",
    desc:`Insert newInterval into sorted non-overlapping intervals.\n\nInput: [[1,3],[6,9]], new=[2,5] → [[1,5],[6,9]]`,
    sol:`def insert(intervals,new):\n    res=[]\n    for i,(s,e) in enumerate(intervals):\n        if new[1]<s: res.append(new); return res+intervals[i:]\n        elif new[0]>e: res.append([s,e])\n        else: new=[min(new[0],s),max(new[1],e)]\n    res.append(new); return res`,
    note:"Three cases: before, after, overlap→merge. O(n)." },
  { id:36, title:"Merge Intervals",                      cat:"Interval",  diff:"Medium", lc:56,  pat:"Intervals",
    desc:`Merge all overlapping intervals.\n\nInput: [[1,3],[2,6],[8,10]] → [[1,6],[8,10]]`,
    sol:`def merge(intervals):\n    intervals.sort(key=lambda x:x[0]); res=[intervals[0]]\n    for s,e in intervals[1:]:\n        if s<=res[-1][1]: res[-1][1]=max(res[-1][1],e)\n        else: res.append([s,e])\n    return res`,
    note:"Sort by start. Overlap→extend, else append. O(n log n)." },
  { id:37, title:"Non-overlapping Intervals",            cat:"Interval",  diff:"Medium", lc:435, pat:"Greedy",
    desc:`Min intervals to remove for non-overlap.\n\nInput: [[1,2],[2,3],[3,4],[1,3]] → 1`,
    sol:`def eraseOverlapIntervals(intervals):\n    intervals.sort(); res=0; end=intervals[0][1]\n    for s,e in intervals[1:]:\n        if s>=end: end=e\n        else: res+=1; end=min(end,e)\n    return res`,
    note:"Sort. On overlap remove the one with larger end (greedy). O(n log n)." },
  { id:38, title:"Meeting Rooms",                        cat:"Interval",  diff:"Easy",   lc:252, pat:"Intervals",
    desc:`Can person attend all meetings?\n\nInput: [[0,30],[5,10],[15,20]] → false`,
    sol:`def canAttendMeetings(intervals):\n    intervals.sort(key=lambda x:x[0])\n    for i in range(1,len(intervals)):\n        if intervals[i][0]<intervals[i-1][1]: return False\n    return True`,
    note:"Sort by start. Any overlap→false. O(n log n)." },
  { id:39, title:"Meeting Rooms II",                     cat:"Interval",  diff:"Medium", lc:253, pat:"Heap",
    desc:`Min conference rooms required.\n\nInput: [[0,30],[5,10],[15,20]] → 2`,
    sol:`import heapq\ndef minMeetingRooms(intervals):\n    intervals.sort(key=lambda x:x[0]); h=[]\n    for s,e in intervals:\n        if h and h[0]<=s: heapq.heapreplace(h,e)\n        else: heapq.heappush(h,e)\n    return len(h)`,
    note:"Min-heap of end times. Reuse if free. Heap size=rooms. O(n log n)." },
  { id:40, title:"Reverse Linked List",                  cat:"Linked List",diff:"Easy",  lc:206, pat:"Linked List",
    desc:`Reverse a singly linked list.\n\nInput: 1→2→3→4→5 → 5→4→3→2→1`,
    sol:`def reverseList(head):\n    prev=None; curr=head\n    while curr: nxt=curr.next; curr.next=prev; prev=curr; curr=nxt\n    return prev`,
    note:"Three pointers: prev, curr, next. Reverse each link. O(n), O(1)." },
  { id:41, title:"Linked List Cycle",                    cat:"Linked List",diff:"Easy",  lc:141, pat:"Fast & Slow Pointers",
    desc:`Does the linked list have a cycle?`,
    sol:`def hasCycle(head):\n    s=f=head\n    while f and f.next:\n        s=s.next; f=f.next.next\n        if s==f: return True\n    return False`,
    note:"Floyd's: fast (2x) meets slow in cycle. Fast hits None=no cycle. O(n), O(1)." },
  { id:42, title:"Merge Two Sorted Lists",               cat:"Linked List",diff:"Easy",  lc:21,  pat:"Linked List",
    desc:`Merge two sorted linked lists.\n\nInput: 1→2→4,  1→3→4 → 1→1→2→3→4→4`,
    sol:`def mergeTwoLists(l1,l2):\n    d=cur=ListNode()\n    while l1 and l2:\n        if l1.val<=l2.val: cur.next=l1; l1=l1.next\n        else: cur.next=l2; l2=l2.next\n        cur=cur.next\n    cur.next=l1 or l2\n    return d.next`,
    note:"Dummy head simplifies edge cases. Append remainder. O(n+m)." },
  { id:43, title:"Merge K Sorted Lists",                 cat:"Linked List",diff:"Hard",  lc:23,  pat:"Heap",
    desc:`Merge k sorted linked lists into one.`,
    sol:`import heapq\ndef mergeKLists(lists):\n    h=[]\n    for i,l in enumerate(lists):\n        if l: heapq.heappush(h,(l.val,i,l))\n    d=cur=ListNode()\n    while h:\n        v,i,n=heapq.heappop(h); cur.next=n; cur=cur.next\n        if n.next: heapq.heappush(h,(n.next.val,i,n.next))\n    return d.next`,
    note:"Min-heap of (val,idx,node). Pop min, push its next. O(N log k)." },
  { id:44, title:"Remove Nth Node From End",             cat:"Linked List",diff:"Medium",lc:19,  pat:"Fast & Slow Pointers",
    desc:`Remove nth node from end in one pass.\n\nInput: 1→2→3→4→5, n=2 → 1→2→3→5`,
    sol:`def removeNthFromEnd(head,n):\n    d=ListNode(0,head); l=d; r=head\n    for _ in range(n): r=r.next\n    while r: l=l.next; r=r.next\n    l.next=l.next.next\n    return d.next`,
    note:"Offset r by n. Move both until r=None. l.next is target. O(n)." },
  { id:45, title:"Reorder List",                         cat:"Linked List",diff:"Medium",lc:143, pat:"Linked List",
    desc:`L0→L1→…→Ln → L0→Ln→L1→Ln-1\n\nInput: 1→2→3→4 → 1→4→2→3`,
    sol:`def reorderList(head):\n    s,f=head,head.next\n    while f and f.next: s=s.next; f=f.next.next\n    sec=s.next; s.next=None; prev=None\n    while sec: nxt=sec.next; sec.next=prev; prev=sec; sec=nxt\n    f1,f2=head,prev\n    while f2: t1,t2=f1.next,f2.next; f1.next=f2; f2.next=t1; f1,f2=t1,t2`,
    note:"3 steps: find mid, reverse 2nd half, interleave. O(n), O(1)." },
  { id:46, title:"Set Matrix Zeroes",                    cat:"Matrix",    diff:"Medium", lc:73,  pat:"Matrix",
    desc:`If element is 0, set entire row and column to 0. In-place.`,
    sol:`def setZeroes(m):\n    R,C=len(m),len(m[0])\n    rz=any(m[0][c]==0 for c in range(C))\n    for r in range(1,R):\n        for c in range(C):\n            if m[r][c]==0: m[0][c]=0; m[r][0]=0\n    for r in range(1,R):\n        for c in range(1,C):\n            if m[0][c]==0 or m[r][0]==0: m[r][c]=0\n    if m[0][0]==0:\n        for r in range(R): m[r][0]=0\n    if rz:\n        for c in range(C): m[0][c]=0`,
    note:"First row/col as markers. Handle first row separately. O(m×n), O(1)." },
  { id:47, title:"Spiral Matrix",                        cat:"Matrix",    diff:"Medium", lc:54,  pat:"Matrix",
    desc:`All elements in spiral order.\n\nInput: [[1,2,3],[4,5,6],[7,8,9]] → [1,2,3,6,9,8,7,4,5]`,
    sol:`def spiralOrder(m):\n    res=[]; l,r,t,b=0,len(m[0])-1,0,len(m)-1\n    while l<=r and t<=b:\n        for c in range(l,r+1): res.append(m[t][c])\n        t+=1\n        for row in range(t,b+1): res.append(m[row][r])\n        r-=1\n        if t<=b:\n            for c in range(r,l-1,-1): res.append(m[b][c])\n            b-=1\n        if l<=r:\n            for row in range(b,t-1,-1): res.append(m[row][l])\n            l+=1\n    return res`,
    note:"Four boundaries shrink inward. O(m×n)." },
  { id:48, title:"Rotate Image",                         cat:"Matrix",    diff:"Medium", lc:48,  pat:"Matrix",
    desc:`Rotate n×n matrix 90° clockwise in-place.`,
    sol:`def rotate(m):\n    n=len(m)\n    for i in range(n):\n        for j in range(i+1,n): m[i][j],m[j][i]=m[j][i],m[i][j]\n    for row in m: row.reverse()`,
    note:"Transpose then reverse each row = 90° CW. In-place, O(n²)." },
  { id:49, title:"Word Search",                          cat:"Matrix",    diff:"Medium", lc:79,  pat:"Backtracking",
    desc:`Word constructable from adjacent board cells (no reuse)?`,
    sol:`def exist(board,word):\n    R,C=len(board),len(board[0]); path=set()\n    def dfs(r,c,i):\n        if i==len(word): return True\n        if r<0 or c<0 or r>=R or c>=C or word[i]!=board[r][c] or (r,c) in path: return False\n        path.add((r,c))\n        res=any(dfs(r+dr,c+dc,i+1) for dr,dc in[(1,0),(-1,0),(0,1),(0,-1)])\n        path.remove((r,c)); return res\n    return any(dfs(r,c,0) for r in range(R) for c in range(C))`,
    note:"DFS + backtracking. path set prevents revisit. Remove on backtrack. O(m×n×4^L)." },
  { id:50, title:"Longest Substring No Repeat",          cat:"String",    diff:"Medium", lc:3,   pat:"Sliding Window",
    desc:`Longest substring without repeating chars.\n\nInput: 'abcabcbb' → 3`,
    sol:`def lengthOfLongestSubstring(s):\n    cs=set(); l=res=0\n    for r in range(len(s)):\n        while s[r] in cs: cs.remove(s[l]); l+=1\n        cs.add(s[r]); res=max(res,r-l+1)\n    return res`,
    note:"Sliding window. Shrink left when duplicate found. O(n)." },
  { id:51, title:"Longest Repeating Char Replacement",   cat:"String",    diff:"Medium", lc:424, pat:"Sliding Window",
    desc:`At most k replacements. Longest same-letter substring.\n\nInput: 'AABABBA', k=1 → 4`,
    sol:`def characterReplacement(s,k):\n    cnt={}; res=l=0\n    for r in range(len(s)):\n        cnt[s[r]]=cnt.get(s[r],0)+1\n        while (r-l+1)-max(cnt.values())>k: cnt[s[l]]-=1; l+=1\n        res=max(res,r-l+1)\n    return res`,
    note:"(window_size - max_freq) ≤ k = valid. O(n×26)=O(n)." },
  { id:52, title:"Minimum Window Substring",             cat:"String",    diff:"Hard",   lc:76,  pat:"Sliding Window",
    desc:`Min window in s containing all chars of t.\n\nInput: 'ADOBECODEBANC', 'ABC' → 'BANC'`,
    sol:`def minWindow(s,t):\n    if not t: return ''\n    ct,w={},{}\n    for c in t: ct[c]=ct.get(c,0)+1\n    have=need=len(ct); res=[-1,-1]; rl=float('inf'); l=0\n    for r in range(len(s)):\n        c=s[r]; w[c]=w.get(c,0)+1\n        if c in ct and w[c]==ct[c]: have-=1\n        while have==0:\n            if r-l+1<rl: rl=r-l+1; res=[l,r]\n            w[s[l]]-=1\n            if s[l] in ct and w[s[l]]<ct[s[l]]: have+=1\n            l+=1\n    l,r=res; return s[l:r+1] if rl!=float('inf') else ''`,
    note:"have/need counters. Expand right, shrink left while valid. O(n+m)." },
  { id:53, title:"Valid Anagram",                        cat:"String",    diff:"Easy",   lc:242, pat:"Hash Map",
    desc:`Is t an anagram of s?\n\nInput: 'anagram', 'nagaram' → true`,
    sol:`from collections import Counter\ndef isAnagram(s,t): return len(s)==len(t) and Counter(s)==Counter(t)`,
    note:"Counter compares char frequencies. O(n)." },
  { id:54, title:"Group Anagrams",                       cat:"String",    diff:"Medium", lc:49,  pat:"Hash Map",
    desc:`Group strings that are anagrams of each other.\n\nInput: ['eat','tea','tan','ate','nat','bat']`,
    sol:`from collections import defaultdict\ndef groupAnagrams(strs):\n    ans=defaultdict(list)\n    for s in strs:\n        k=[0]*26\n        for c in s: k[ord(c)-97]+=1\n        ans[tuple(k)].append(s)\n    return list(ans.values())`,
    note:"Key=char freq tuple (26 ints). Groups without sorting. O(n×m)." },
  { id:55, title:"Valid Parentheses",                    cat:"String",    diff:"Easy",   lc:20,  pat:"Stack",
    desc:`Properly opened/closed brackets?\n\nInput: '()[]{}' → true`,
    sol:`def isValid(s):\n    st=[]; m={')':'(',']':'[','}':'{'}\n    for c in s:\n        if c in m:\n            if not st or st[-1]!=m[c]: return False\n            st.pop()\n        else: st.append(c)\n    return not st`,
    note:"Push open brackets. On close, check stack top. O(n)." },
  { id:56, title:"Valid Palindrome",                     cat:"String",    diff:"Easy",   lc:125, pat:"Two Pointers",
    desc:`Alphanumeric only, lowercased — palindrome?\n\nInput: 'A man, a plan, a canal: Panama' → true`,
    sol:`def isPalindrome(s):\n    l,r=0,len(s)-1\n    while l<r:\n        while l<r and not s[l].isalnum(): l+=1\n        while l<r and not s[r].isalnum(): r-=1\n        if s[l].lower()!=s[r].lower(): return False\n        l+=1; r-=1\n    return True`,
    note:"Two pointers, skip non-alphanumeric inline. O(n), O(1)." },
  { id:57, title:"Longest Palindromic Substring",        cat:"String",    diff:"Medium", lc:5,   pat:"Two Pointers",
    desc:`Return longest palindromic substring.\n\nInput: 'babad' → 'bab'`,
    sol:`def longestPalindrome(s):\n    res=''\n    for i in range(len(s)):\n        for l,r in[(i,i),(i,i+1)]:\n            while l>=0 and r<len(s) and s[l]==s[r]:\n                if r-l+1>len(res): res=s[l:r+1]\n                l-=1; r+=1\n    return res`,
    note:"Expand around center. Odd+even. O(n²), O(1)." },
  { id:58, title:"Palindromic Substrings",               cat:"String",    diff:"Medium", lc:647, pat:"Two Pointers",
    desc:`Count palindromic substrings.\n\nInput: 'aaa' → 6`,
    sol:`def countSubstrings(s):\n    cnt=0\n    for i in range(len(s)):\n        for l,r in[(i,i),(i,i+1)]:\n            while l>=0 and r<len(s) and s[l]==s[r]: cnt+=1; l-=1; r+=1\n    return cnt`,
    note:"Expand around center, count each expansion. O(n²)." },
  { id:59, title:"Encode and Decode Strings",            cat:"String",    diff:"Medium", lc:271, pat:"String Encoding",
    desc:`Encode list of strings ↔ single string. Must handle any characters.`,
    sol:`def encode(strs): return ''.join(f'{len(s)}#{s}' for s in strs)\ndef decode(s):\n    res=[]; i=0\n    while i<len(s):\n        j=s.index('#',i); n=int(s[i:j])\n        res.append(s[j+1:j+1+n]); i=j+1+n\n    return res`,
    note:"Length-prefix '4#word'. Handles any chars. O(n)." },
  { id:60, title:"Maximum Depth of Binary Tree",         cat:"Tree",      diff:"Easy",   lc:104, pat:"DFS",
    desc:`Max depth of binary tree.\n\nInput: [3,9,20,null,null,15,7] → 3`,
    sol:`def maxDepth(root):\n    if not root: return 0\n    return 1+max(maxDepth(root.left),maxDepth(root.right))`,
    note:"1 + max(left,right). Recursive. O(n)." },
  { id:61, title:"Same Tree",                            cat:"Tree",      diff:"Easy",   lc:100, pat:"DFS",
    desc:`Are two binary trees identical?`,
    sol:`def isSameTree(p,q):\n    if not p and not q: return True\n    if not p or not q or p.val!=q.val: return False\n    return isSameTree(p.left,q.left) and isSameTree(p.right,q.right)`,
    note:"Both null=True, one null=False, diff val=False. Recurse. O(n)." },
  { id:62, title:"Invert Binary Tree",                   cat:"Tree",      diff:"Easy",   lc:226, pat:"DFS",
    desc:`Mirror a binary tree.\n\nInput: [4,2,7,1,3,6,9] → [4,7,2,9,6,3,1]`,
    sol:`def invertTree(root):\n    if not root: return None\n    root.left,root.right=invertTree(root.right),invertTree(root.left)\n    return root`,
    note:"Swap children, recursively invert. O(n)." },
  { id:63, title:"Binary Tree Maximum Path Sum",         cat:"Tree",      diff:"Hard",   lc:124, pat:"DFS",
    desc:`Max sum path from any node to any node.\n\nInput: [-10,9,20,null,null,15,7] → 42`,
    sol:`def maxPathSum(root):\n    res=[root.val]\n    def dfs(r):\n        if not r: return 0\n        l=max(dfs(r.left),0); ri=max(dfs(r.right),0)\n        res[0]=max(res[0],r.val+l+ri)\n        return r.val+max(l,ri)\n    dfs(root); return res[0]`,
    note:"At each node: candidate=node+left+right. Return node+max(one side) up. O(n)." },
  { id:64, title:"Binary Tree Level Order Traversal",    cat:"Tree",      diff:"Medium", lc:102, pat:"BFS",
    desc:`Level-order traversal as list of lists.\n\nInput: [3,9,20,null,null,15,7] → [[3],[9,20],[15,7]]`,
    sol:`from collections import deque\ndef levelOrder(root):\n    res=[]; q=deque([root]) if root else deque()\n    while q:\n        lvl=[]\n        for _ in range(len(q)):\n            n=q.popleft(); lvl.append(n.val)\n            if n.left: q.append(n.left)\n            if n.right: q.append(n.right)\n        res.append(lvl)\n    return res`,
    note:"BFS with deque. Snapshot len(q) at level start. O(n)." },
  { id:65, title:"Serialize and Deserialize Binary Tree", cat:"Tree",     diff:"Hard",   lc:297, pat:"DFS",
    desc:`Design serialize/deserialize for binary tree.`,
    sol:`def serialize(root):\n    res=[]\n    def dfs(n):\n        if not n: res.append('N'); return\n        res.append(str(n.val)); dfs(n.left); dfs(n.right)\n    dfs(root); return ','.join(res)\ndef deserialize(data):\n    v=iter(data.split(','))\n    def dfs():\n        x=next(v)\n        if x=='N': return None\n        n=TreeNode(int(x)); n.left=dfs(); n.right=dfs(); return n\n    return dfs()`,
    note:"Pre-order DFS. 'N' marks null. Iterator naturally follows order. O(n)." },
  { id:66, title:"Subtree of Another Tree",              cat:"Tree",      diff:"Easy",   lc:572, pat:"DFS",
    desc:`Is subRoot a subtree of root?`,
    sol:`def isSubtree(s,t):\n    def same(a,b):\n        if not a and not b: return True\n        if not a or not b or a.val!=b.val: return False\n        return same(a.left,b.left) and same(a.right,b.right)\n    if not t: return True\n    if not s: return False\n    return same(s,t) or isSubtree(s.left,t) or isSubtree(s.right,t)`,
    note:"At each node check same(). O(m×n)." },
  { id:67, title:"Construct BT from Preorder/Inorder",   cat:"Tree",      diff:"Medium", lc:105, pat:"DFS",
    desc:`Reconstruct binary tree from preorder and inorder traversals.`,
    sol:`def buildTree(pre,ino):\n    if not pre or not ino: return None\n    r=TreeNode(pre[0]); m=ino.index(pre[0])\n    r.left=buildTree(pre[1:m+1],ino[:m])\n    r.right=buildTree(pre[m+1:],ino[m+1:])\n    return r`,
    note:"pre[0]=root. Find in inorder to split subtrees. O(n²) naive, O(n) with hashmap." },
  { id:68, title:"Validate Binary Search Tree",          cat:"Tree",      diff:"Medium", lc:98,  pat:"DFS",
    desc:`Is this a valid BST?`,
    sol:`def isValidBST(root):\n    def v(n,lo,hi):\n        if not n: return True\n        if not (lo<n.val<hi): return False\n        return v(n.left,lo,n.val) and v(n.right,n.val,hi)\n    return v(root,float('-inf'),float('inf'))`,
    note:"Pass valid range down. Each node strictly within. O(n)." },
  { id:69, title:"Kth Smallest Element in BST",          cat:"Tree",      diff:"Medium", lc:230, pat:"DFS",
    desc:`kth smallest value in BST.\n\nInput: root=[3,1,4,null,2], k=1 → 1`,
    sol:`def kthSmallest(root,k):\n    st=[]; c=root\n    while True:\n        while c: st.append(c); c=c.left\n        c=st.pop(); k-=1\n        if k==0: return c.val\n        c=c.right`,
    note:"Iterative in-order = sorted. Return at k=0. O(h+k)." },
  { id:70, title:"Lowest Common Ancestor of BST",        cat:"Tree",      diff:"Medium", lc:235, pat:"DFS",
    desc:`Find LCA of p and q in BST.`,
    sol:`def lowestCommonAncestor(root,p,q):\n    c=root\n    while c:\n        if p.val>c.val and q.val>c.val: c=c.right\n        elif p.val<c.val and q.val<c.val: c=c.left\n        else: return c`,
    note:"Both>cur→right, both<cur→left, split=LCA. O(h)." },
  { id:71, title:"Implement Trie",                       cat:"Tree",      diff:"Medium", lc:208, pat:"Trie",
    desc:`Trie with insert(word), search(word), startsWith(prefix).`,
    sol:`class TrieNode:\n    def __init__(self): self.c={}; self.end=False\nclass Trie:\n    def __init__(self): self.r=TrieNode()\n    def insert(self,w):\n        n=self.r\n        for c in w:\n            if c not in n.c: n.c[c]=TrieNode()\n            n=n.c[c]\n        n.end=True\n    def search(self,w):\n        n=self.r\n        for c in w:\n            if c not in n.c: return False\n            n=n.c[c]\n        return n.end\n    def startsWith(self,p):\n        n=self.r\n        for c in p:\n            if c not in n.c: return False\n            n=n.c[c]\n        return True`,
    note:"Each node: children dict + end flag. All ops O(m)." },
  { id:72, title:"Design Add and Search Words",          cat:"Tree",      diff:"Medium", lc:211, pat:"Trie",
    desc:`addWord and search where '.' matches any letter.`,
    sol:`class WordDictionary:\n    def __init__(self): self.r=TrieNode()\n    def addWord(self,w):\n        n=self.r\n        for c in w:\n            if c not in n.c: n.c[c]=TrieNode()\n            n=n.c[c]\n        n.end=True\n    def search(self,w):\n        def dfs(i,n):\n            for j in range(i,len(w)):\n                c=w[j]\n                if c=='.':\n                    return any(dfs(j+1,ch) for ch in n.c.values())\n                if c not in n.c: return False\n                n=n.c[c]\n            return n.end\n        return dfs(0,self.r)`,
    note:"Standard Trie + DFS on '.'. Try all children for wildcard. O(26^m) worst." },
  { id:73, title:"Word Search II",                       cat:"Tree",      diff:"Hard",   lc:212, pat:"Trie + Backtracking",
    desc:`Find all words from list constructable in board.`,
    sol:`def findWords(board,words):\n    class T:\n        def __init__(self): self.c={}; self.end=None\n    r=T()\n    for w in words:\n        n=r\n        for c in w:\n            if c not in n.c: n.c[c]=T()\n            n=n.c[c]\n        n.end=w\n    R,C=len(board),len(board[0]); res=set(); vis=set()\n    def dfs(r,c,n):\n        if r<0 or c<0 or r>=R or c>=C or (r,c) in vis or board[r][c] not in n.c: return\n        vis.add((r,c)); n=n.c[board[r][c]]\n        if n.end: res.add(n.end)\n        for dr,dc in[(1,0),(-1,0),(0,1),(0,-1)]: dfs(r+dr,c+dc,n)\n        vis.remove((r,c))\n    for r in range(R):\n        for c in range(C): dfs(r,c,r)\n    return list(res)`,
    note:"Build Trie. DFS guided by Trie — prune when prefix missing. O(m×n×4^L)." },
  { id:74, title:"Top K Frequent Elements",              cat:"Heap",      diff:"Medium", lc:347, pat:"Bucket Sort",
    desc:`Return k most frequent elements.\n\nInput: [1,1,1,2,2,3], k=2 → [1,2]`,
    sol:`def topKFrequent(nums,k):\n    cnt={}; freq=[[] for _ in range(len(nums)+1)]\n    for n in nums: cnt[n]=cnt.get(n,0)+1\n    for n,c in cnt.items(): freq[c].append(n)\n    res=[]\n    for i in range(len(freq)-1,0,-1):\n        for n in freq[i]:\n            res.append(n)\n            if len(res)==k: return res`,
    note:"Bucket sort by freq. Scan R→L. O(n) time and space." },
  { id:75, title:"Find Median from Data Stream",         cat:"Heap",      diff:"Hard",   lc:295, pat:"Two Heaps",
    desc:`addNum(int) and findMedian() on a growing stream.`,
    sol:`import heapq\nclass MedianFinder:\n    def __init__(self): self.lo=[]; self.hi=[]\n    def addNum(self,n):\n        heapq.heappush(self.lo,-n)\n        if self.lo and self.hi and -self.lo[0]>self.hi[0]:\n            heapq.heappush(self.hi,-heapq.heappop(self.lo))\n        if len(self.lo)>len(self.hi)+1:\n            heapq.heappush(self.hi,-heapq.heappop(self.lo))\n        if len(self.hi)>len(self.lo):\n            heapq.heappush(self.lo,-heapq.heappop(self.hi))\n    def findMedian(self):\n        if len(self.lo)>len(self.hi): return -self.lo[0]\n        return (-self.lo[0]+self.hi[0])/2`,
    note:"Max-heap left, min-heap right. Keep balanced. O(log n) add, O(1) median." },
];

const CATS=[...new Set(P.map(p=>p.cat))];
const DC={Easy:"#4ade80",Medium:"#fb923c",Hard:"#f87171"};
const REV_XP_MULT=2;

// ─── STORAGE (SQLite via server, localStorage fallback) ───────
async function load(){
  try{const r=await fetch('/api/progress');if(r.ok)return await r.json();}catch{}
  try{const r=localStorage.getItem('s75v3');return r?JSON.parse(r):null;}catch{return null;}
}
async function save(s){
  try{await fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)});return;}catch{}
  try{localStorage.setItem('s75v3',JSON.stringify(s));}catch{}
}

// ─── MSG RENDERER ─────────────────────────────────────────────
function Msg({text}){
  const parts=text.split(/(```[\s\S]*?```|\*\*[^*]+\*\*|`[^`]+`)/g);
  return <span>{parts.map((p,i)=>{
    if(p.startsWith("```")&&p.endsWith("```")){
      const c=p.slice(3,-3).replace(/^python\n/,'').replace(/^\n/,'');
      return <pre key={i} style={{background:"var(--code)",border:"1px solid #1a3a5f",borderRadius:5,padding:"7px 10px",fontSize:11,overflowX:"auto",margin:"5px 0",lineHeight:1.5}}><code style={{color:"#93c5fd"}}>{c}</code></pre>;
    }
    if(p.startsWith("**")&&p.endsWith("**")) return <strong key={i} style={{color:"#fbbf24"}}>{p.slice(2,-2)}</strong>;
    if(p.startsWith("`")&&p.endsWith("`")) return <code key={i} style={{background:"#1e2a3a",color:"#7dd3fc",padding:"1px 4px",borderRadius:3,fontSize:11}}>{p.slice(1,-1)}</code>;
    return <span key={i}>{p}</span>;
  })}</span>;
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function App(){
  const [boot,setBoot]=useState(true);
  const [prob,setProb]=useState(P[0]);
  const [code,setCode]=useState("# Write your solution here\n\ndef solution():\n    pass\n");
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Pick a problem. Start with brute force."}]);
  const [inp,setInp]=useState("");
  const [aiLoad,setAiLoad]=useState(false);

  // Progress
  const [solved,setSolved]=useState(new Set());
  const [attempted,setAttempted]=useState(new Set());
  const [streak,setStreak]=useState(0);
  const [xp,setXp]=useState(0);
  const [lastDay,setLastDay]=useState(null);
  const [todayDone,setTodayDone]=useState(new Set());
  const [notes,setNotes]=useState({});

  // Revision system
  const [history,setHistory]=useState({}); // {pid: {firstSolved, lastRevised, revCount}}
  const [revMode,setRevMode]=useState(false);
  const [revSecs,setRevSecs]=useState(0);
  const [revRunning,setRevRunning]=useState(false);

  // UI
  const [tab,setTab]=useState("desc");
  const [showSol,setShowSol]=useState(false);
  const [cats,setCats]=useState(new Set(["Array"]));
  const [sb,setSb]=useState(true);
  const [view,setView]=useState("practice");
  const [peekOn,setPeekOn]=useState(true);
  const [peeking,setPeeking]=useState(false);
  const [dk,setDk]=useState(()=>localStorage.getItem('dk')!=='light');

  const chatRef=useRef(null);
  const peekTimer=useRef(null);
  const lastPeeked=useRef({code:"",pid:null});
  const revInterval=useRef(null);
  const TMPL="# Write your solution here\n\ndef solution():\n    pass\n";

  // ── LOAD ──
  useEffect(()=>{
    load().then(s=>{
      if(s){
        setSolved(new Set(s.solved||[]));
        setAttempted(new Set(s.attempted||[]));
        setStreak(s.streak||0);
        setXp(s.xp||0);
        setNotes(s.notes||{});
        setHistory(s.history||{});
        const today=todayKey();
        if(s.lastDay===today) setTodayDone(new Set(s.todayDone||[]));
        else{
          const yd=new Date(); yd.setDate(yd.getDate()-1);
          const yk=`${yd.getFullYear()}-${yd.getMonth()}-${yd.getDate()}`;
          if(s.lastDay!==yk&&(s.streak||0)>0) setStreak(0);
          setTodayDone(new Set());
        }
        setLastDay(s.lastDay||null);
      }
      setBoot(false);
    });
  },[]);

  // ── SAVE ──
  useEffect(()=>{
    if(!boot) save({solved:[...solved],attempted:[...attempted],streak,xp,notes,history,todayDone:[...todayDone],lastDay});
  },[solved,attempted,streak,xp,notes,history,todayDone,lastDay,boot]);

  // ── SCROLL ──
  useEffect(()=>{chatRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  // ── REVISION TIMER ──
  useEffect(()=>{
    if(revRunning && revSecs>0){
      revInterval.current=setInterval(()=>{
        setRevSecs(t=>{
          if(t<=1){clearInterval(revInterval.current);setRevRunning(false);return 0;}
          return t-1;
        });
      },1000);
    }
    return()=>clearInterval(revInterval.current);
  },[revRunning]);

  // ── LIVE PEEK ──
  useEffect(()=>{
    if(!peekOn||aiLoad||revMode) return;
    const stripped=code.trim();
    if(stripped===TMPL.trim()||stripped.length<30) return;
    if(stripped===lastPeeked.current.code&&prob.id===lastPeeked.current.pid) return;
    clearTimeout(peekTimer.current);
    setPeeking(true);
    peekTimer.current=setTimeout(async()=>{
      if(aiLoad) return;
      lastPeeked.current={code:stripped,pid:prob.id};
      setPeeking(false);
      const peekMsgs=[...msgs,{role:"user",content:`[LIVE PEEK — still coding]\n\`\`\`python\n${code}\n\`\`\``}];
      setAiLoad(true);
      try{
        const res=await fetch("/api/messages",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:80,
            system:buildPrompt(prob,false)+"\n\nLIVE PEEK: student still coding. Only speak if you see a clear wrong direction. If on track say exactly: [skip]. Max 1 sentence.",
            messages:peekMsgs.map(m=>({role:m.role,content:m.content}))})
        });
        const d=await res.json();
        const reply=d.content?.[0]?.text||"";
        if(reply&&reply.trim()!=="[skip]") setMsgs(p=>[...p,{role:"assistant",content:reply,peek:true}]);
      }catch{}
      finally{setAiLoad(false);}
    },4000);
    return()=>{clearTimeout(peekTimer.current);setPeeking(false);};
  },[code]);

  useEffect(()=>{
    lastPeeked.current={code:"",pid:prob.id};
    clearTimeout(peekTimer.current);setPeeking(false);
  },[prob.id]);

  // ── AI CALL ──
  const call=async(text,withCode=false,system=null)=>{
    if(!text.trim()&&!withCode) return;
    const full=withCode?`${text}\n\nMy code:\n\`\`\`python\n${code}\n\`\`\``:text;
    const newMsgs=[...msgs,{role:"user",content:full}];
    setMsgs(newMsgs);setInp("");setAiLoad(true);
    try{
      const res=await fetch("/api/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:100,
          system:system||buildPrompt(prob,revMode),
          messages:newMsgs.map(m=>({role:m.role,content:m.content}))})
      });
      const d=await res.json();
      const reply=d.content?.[0]?.text||(d.error?.message?`[${d.error.type}] ${d.error.message}`:d.error||"No response.");
      setMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){setMsgs(p=>[...p,{role:"assistant",content:`Network error: ${e.message}`}]);}
    finally{setAiLoad(false);}
  };

  // ── SELECT PROBLEM ──
  const selectProb=(p)=>{
    if(revMode){setRevMode(false);setRevRunning(false);clearInterval(revInterval.current);}
    setProb(p);setCode(TMPL);setShowSol(false);setTab("desc");
    setAttempted(prev=>new Set([...prev,p.id]));
    setMsgs([{role:"assistant",content:`**${p.title}**. What's your brute force?`}]);
  };

  // ── START REVISION ──
  const startRevision=(p)=>{
    setProb(p);setRevMode(true);setRevSecs(20*60);setRevRunning(true);
    setCode("# REVISION — no hints. Solve from memory.\n\ndef solution():\n    pass\n");
    setShowSol(false);setTab("desc");setView("practice");
    setMsgs([{role:"assistant",content:`⏱ **Revision.** 20 min. No hints. Go.`}]);
    lastPeeked.current={code:"",pid:p.id};
  };

  // ── MARK SOLVED (practice) ──
  const markSolved=()=>{
    const pid=prob.id; if(solved.has(pid)) return;
    const today=todayKey();
    setSolved(p=>new Set([...p,pid]));
    setTodayDone(p=>new Set([...p,pid]));
    setXp(p=>p+XPV[prob.diff]);
    if(lastDay!==today){setStreak(p=>p+1);setLastDay(today);}
    setHistory(h=>({...h,[pid]:{firstSolved:Date.now(),lastRevised:Date.now(),revCount:0}}));
    call("Submitting — please review.",true);
  };

  // ── MARK REVISION SOLVED ──
  const markRevSolved=()=>{
    const pid=prob.id;
    const today=todayKey();
    const elapsed=20*60-revSecs;
    const cold=elapsed<15*60; // solved in under 15 min = clean cold solve
    const bonus=cold?REV_XP_MULT:1;
    setXp(p=>p+XPV[prob.diff]*bonus);
    setTodayDone(p=>new Set([...p,pid]));
    if(lastDay!==today){setStreak(p=>p+1);setLastDay(today);}
    setHistory(h=>({...h,[pid]:{...(h[pid]||{}),lastRevised:Date.now(),revCount:(h[pid]?.revCount||0)+1}}));
    setRevMode(false);setRevRunning(false);clearInterval(revInterval.current);
    const msg=cold?`✓ Cold solve in ${Math.floor(elapsed/60)}m — **${XPV[prob.diff]*bonus}xp** (${bonus}x). What's the time complexity?`:`✓ Solved. **${XPV[prob.diff]}xp**. Took a while — revisit sooner next time.`;
    setMsgs(p=>[...p,{role:"assistant",content:msg}]);
  };

  // ── DERIVED ──
  const conf=pid=>getConfidence(history,pid);
  const dueProblems=P.filter(p=>solved.has(p.id)&&(conf(p.id)||0)<REV_THRESHOLD);
  const freshProblems=P.filter(p=>solved.has(p.id)&&(conf(p.id)||100)>=REV_THRESHOLD);
  const revQueue=[...dueProblems,...freshProblems.slice(0,Math.max(0,5-dueProblems.length))];
  const dailyGoal=3;
  const dt=dayType(), dn=dayName();
  const lvl=Math.floor(xp/100)+1, lxp=xp%100;
  const sc=solved.size;
  const fmtTime=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const timerWarn=revSecs>0&&revSecs<300; // last 5 min

  if(boot) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",color:"#fbbf24",fontFamily:"monospace",fontSize:13}}>loading...</div>;

  return(
    <div style={{
      "--bg":dk?"#070b12":"#f8f9fb","--panel":dk?"#0a1020":"#ffffff","--sidebar":dk?"#080e1a":"#f0f4f8",
      "--code":dk?"#040912":"#f5f5f8","--panel2":dk?"#0b1525":"#f4f7fb","--chat":dk?"#060c16":"#f8f9fb",
      "--deep":dk?"#0a0f1a":"#e8edf4","--border":dk?"#1a2a40":"#d0dae8","--border2":dk?"#0f1a2a":"#e4eaf4",
      "--border3":dk?"#1a2535":"#dce5f0","--text":dk?"#dde4ef":"#1a2035","--text2":dk?"#5a7090":"#3d5168",
      "--text3":dk?"#2a4060":"#6277a0","--text4":dk?"#1e3050":"#8095b2","--chatmsg":dk?"#0a1525":"#eef2f9",
      "--chatuser":dk?"#0f1e35":"#e0eaf8","--codetext":dk?"#c9d4e8":"#2d3748",
      display:"flex",flexDirection:"column",height:"100vh",background:"var(--bg)",color:"var(--text)",fontFamily:"'JetBrains Mono','Fira Mono',monospace",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:var(--deep);}
        ::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes warn{0%,100%{color:#f87171}50%{color:#fbbf24}}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{background:"var(--panel)",borderBottom:"1px solid var(--border)",height:44,display:"flex",alignItems:"center",padding:"0 14px",gap:12,flexShrink:0}}>
        <button onClick={()=>setSb(p=>!p)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:13}}>☰</button>
        <span style={{fontSize:13,fontWeight:700,color:"#fbbf24",letterSpacing:-0.5}}>⚔ blind75<span style={{color:"#f87171"}}>.</span>sensei</span>

        {revMode?(
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#1a0a0a",border:"1px solid #5a1010",borderRadius:4,padding:"3px 10px"}}>
            <span style={{fontSize:9,color:"#f87171",fontWeight:700}}>⏱ REVISION</span>
            <span style={{fontSize:12,fontWeight:700,color:timerWarn?"#f87171":"#fbbf24",animation:timerWarn?"warn 0.8s infinite":"none"}}>{fmtTime(revSecs)}</span>
            <button onClick={()=>{setRevMode(false);setRevRunning(false);clearInterval(revInterval.current);setCode(TMPL);setMsgs([{role:"assistant",content:"Back to practice."}]);}} style={{background:"none",border:"none",color:"#3a1010",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>✕ exit</button>
          </div>
        ):(
          <div style={{background:dt==='revision'?"#1a2040":"#0f1a10",border:`1px solid ${dt==='revision'?"#2a3a80":"#1a3020"}`,borderRadius:3,padding:"2px 8px",fontSize:9,color:dt==='revision'?"#818cf8":"#4ade80"}}>
            {dn} · {dt==='revision'?"📖 Revision Day":"🔥 Practice Day"}
          </div>
        )}

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:10,color:streak>0?"#fb923c":"var(--text3)"}}>🔥{streak}d</span>
          <span style={{fontSize:10,color:"#7c6fc0"}}>Lv{lvl} <span style={{color:"#3a3060"}}>{lxp}/100</span></span>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10}}>
            <span style={{color:sc>0?"#4ade80":"var(--text3)"}}>{sc}<span style={{color:"var(--text4)"}}>/75</span></span>
            <div style={{width:60,height:3,background:"var(--border)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${(sc/75)*100}%`,background:"linear-gradient(90deg,#f59e0b,#4ade80)",transition:"width 0.5s"}}/></div>
          </div>
          {dueProblems.length>0&&<span style={{fontSize:9,color:"#f87171",background:"#1a0a0a",border:"1px solid #3a1010",padding:"1px 7px",borderRadius:3}}>⚠ {dueProblems.length} due</span>}
          <button onClick={()=>{const n=!dk;setDk(n);localStorage.setItem('dk',n?'dark':'light');}} title={dk?"Light mode":"Dark mode"} style={{padding:"2px 8px",background:"var(--border2)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:3,fontSize:11,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>
            {dk?'☀':'🌙'}
          </button>
          <button onClick={()=>setView(v=>v==='practice'?'dashboard':'practice')} style={{padding:"2px 9px",background:"var(--border2)",border:"1px solid var(--border)",color:"#3a5070",borderRadius:3,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>
            {view==='practice'?'📊':'◀'}
          </button>
        </div>
      </div>

      {/* ── DASHBOARD ── */}
      {view==='dashboard'?(
        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexWrap:"wrap",gap:14,alignContent:"start"}}>

          {/* Daily goal */}
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:200}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:6}}>TODAY</div>
            <div style={{fontSize:26,fontWeight:700,color:todayDone.size>=dailyGoal?"#4ade80":"#fbbf24"}}>{todayDone.size}<span style={{fontSize:13,color:"var(--text3)"}}>/{dailyGoal}</span></div>
            <div style={{marginTop:8,height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(todayDone.size/dailyGoal,1)*100}%`,background:todayDone.size>=dailyGoal?"#4ade80":"#fbbf24",transition:"width 0.4s"}}/></div>
            {todayDone.size>=dailyGoal&&<div style={{marginTop:6,fontSize:9,color:"#4ade80"}}>✓ Goal hit!</div>}
          </div>

          {/* Week calendar */}
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:260}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>WEEK SCHEDULE</div>
            <div style={{display:"flex",gap:5}}>
              {['M','T','W','T','F','S','S'].map((d,i)=>{
                const isPrac=i<5,isToday=i===([0,6,1,2,3,4,5][new Date().getDay()]);
                return <div key={i} style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:8,color:isToday?"#fbbf24":"var(--text4)",marginBottom:3}}>{d}</div>
                  <div style={{height:26,borderRadius:3,background:isToday?(isPrac?"#0f2010":"#0f0f30"):isPrac?"#0a150a":"#0a0a1a",border:`1px solid ${isToday?(isPrac?"#4ade80":"#818cf8"):"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>
                    {isPrac?"💻":"📖"}
                  </div>
                </div>;
              })}
            </div>
            <div style={{marginTop:8,fontSize:9,color:"var(--text4)"}}>Mon–Fri: 3 problems · Sat–Sun: revision</div>
          </div>

          {/* REVISION QUEUE */}
          <div style={{background:"var(--deep)",border:`1px solid ${dueProblems.length>0?"#3a1010":"var(--border)"}`,borderRadius:8,padding:14,minWidth:240}}>
            <div style={{fontSize:10,color:dueProblems.length>0?"#f87171":"var(--text3)",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
              <span>📖 REVISION QUEUE</span>
              {dueProblems.length>0&&<span style={{color:"#f87171"}}>{dueProblems.length} overdue</span>}
            </div>
            {revQueue.length===0&&<div style={{fontSize:10,color:"var(--text4)"}}>Solve some problems first.</div>}
            {revQueue.slice(0,8).map(p=>{
              const c=conf(p.id);
              const fc=fluencyColor(c);
              const fl=fluencyLabel(c);
              return <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid var(--border2)",cursor:"pointer"}} onClick={()=>startRevision(p)}>
                <div style={{width:7,height:7,borderRadius:"50%",background:fc,flexShrink:0,boxShadow:fl==='due'?`0 0 5px ${fc}`:"none"}}/>
                <span style={{flex:1,fontSize:10,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span>
                <span style={{fontSize:9,color:"var(--text3)"}}>{c}%</span>
                <span style={{fontSize:8,color:DC[p.diff]}}>{p.diff[0]}</span>
                <span style={{fontSize:9,color:"var(--text3)",background:"#0f1520",padding:"1px 6px",borderRadius:3}}>▶ revise</span>
              </div>;
            })}
          </div>

          {/* Category progress */}
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:220}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>BY CATEGORY</div>
            {CATS.map(cat=>{
              const total=P.filter(p=>p.cat===cat).length;
              const done=P.filter(p=>p.cat===cat&&solved.has(p.id)).length;
              return <div key={cat} style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                  <span style={{color:"#3a5070"}}>{cat}</span>
                  <span style={{color:done===total&&done>0?"#4ade80":"var(--text4)"}}>{done}/{total}</span>
                </div>
                <div style={{height:3,background:"var(--border)",borderRadius:2}}><div style={{height:"100%",width:`${(done/total)*100}%`,background:done===total?"#4ade80":"#fbbf24",borderRadius:2,transition:"width 0.5s"}}/></div>
              </div>;
            })}
          </div>

          {/* XP */}
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:180}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>XP & LEVELS</div>
            {['Easy','Medium','Hard'].map(d=>{
              const n=P.filter(p=>p.diff===d&&solved.has(p.id)).length;
              return <div key={d} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:10}}>
                <span style={{color:DC[d]}}>{d}</span>
                <span style={{color:"#5a40a0"}}>{n}×{XPV[d]}={n*XPV[d]}</span>
              </div>;
            })}
            <div style={{borderTop:"1px solid var(--border)",marginTop:8,paddingTop:6,fontSize:10,color:"#a78bfa"}}>Total: {xp}xp · Lv{lvl}</div>
            <div style={{marginTop:4,fontSize:9,color:"#3a3060"}}>Revision solve = {REV_XP_MULT}× XP (if cold)</div>
          </div>

          {/* Fluency breakdown */}
          {sc>0&&<div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:200}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>FLUENCY STATUS</div>
            {[["🟢 Fresh (≥80%)",P.filter(p=>solved.has(p.id)&&(conf(p.id)||0)>=80).length,"#4ade80"],
              ["🟡 Stale (50-79%)",P.filter(p=>solved.has(p.id)&&(conf(p.id)||0)>=50&&(conf(p.id)||0)<80).length,"#fbbf24"],
              ["🔴 Due (<50%)",P.filter(p=>solved.has(p.id)&&(conf(p.id)||0)<50).length,"#f87171"]
            ].map(([label,count,color])=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:10}}>
                <span style={{color:"#3a5070"}}>{label}</span>
                <span style={{color}}>{count}</span>
              </div>
            ))}
          </div>}
        </div>
      ):(
      /* ── PRACTICE VIEW ── */
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── SIDEBAR ── */}
        <div style={{width:sb?195:0,background:"var(--sidebar)",borderRight:"1px solid var(--border)",overflow:"hidden",transition:"width 0.2s",flexShrink:0}}>
          <div style={{width:195,height:"100%",overflowY:"auto",paddingBottom:16}}>
            {CATS.map(cat=>{
              const cPs=P.filter(p=>p.cat===cat);
              const cS=cPs.filter(p=>solved.has(p.id)).length;
              const open=cats.has(cat);
              return <div key={cat}>
                <div onClick={()=>setCats(prev=>{const n=new Set(prev);n.has(cat)?n.delete(cat):n.add(cat);return n;})}
                  style={{padding:"7px 12px",fontSize:"9px",fontWeight:700,letterSpacing:"0.8px",color:"var(--text4)",cursor:"pointer",display:"flex",justifyContent:"space-between",userSelect:"none",borderTop:"1px solid var(--border2)"}}>
                  <span>{cat.toUpperCase()}</span>
                  <span style={{color:cS===cPs.length&&cPs.length>0?"#4ade80":"var(--border)"}}>{cS}/{cPs.length} {open?"▾":"▸"}</span>
                </div>
                {open&&cPs.map(p=>{
                  const isSel=prob.id===p.id,isSolv=solved.has(p.id),isAtt=attempted.has(p.id);
                  const c=conf(p.id);
                  const fc=fluencyColor(c);
                  return <div key={p.id} onClick={()=>selectProb(p)}
                    style={{padding:"4px 10px 4px 13px",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:5,background:isSel?"rgba(251,191,36,0.06)":"transparent",borderLeft:isSel?"2px solid #fbbf24":"2px solid transparent",color:isSel?"#fbbf24":isSolv?"#4ade80":isAtt?"var(--text2)":"var(--text4)"}}>
                    <span style={{fontSize:9,flexShrink:0,color:isSolv?"#4ade80":isAtt?"#fb923c":"var(--border)"}}>{isSolv?"✓":isAtt?"◐":"○"}</span>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,fontSize:9.5}}>{p.title}</span>
                    {/* Fluency dot */}
                    {isSolv&&fc&&<div style={{width:5,height:5,borderRadius:"50%",background:fc,flexShrink:0,boxShadow:`0 0 3px ${fc}`}}/>}
                    <span style={{fontSize:8,color:DC[p.diff],flexShrink:0}}>{p.diff[0]}</span>
                  </div>;
                })}
              </div>;
            })}
          </div>
        </div>

        {/* ── CENTER ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

          {/* Problem header */}
          <div style={{padding:"7px 12px",background:"var(--panel)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:600,color:revMode?"#f87171":"var(--text)"}}>{revMode?"⏱ ":""}{prob.title}</span>
            <span style={{fontSize:9,color:DC[prob.diff],border:`1px solid ${DC[prob.diff]}`,padding:"1px 6px",borderRadius:8}}>{prob.diff}</span>
            <span style={{fontSize:9,color:"var(--text4)",background:"var(--border2)",padding:"1px 6px",borderRadius:8}}>{prob.pat}</span>
            {solved.has(prob.id)&&!revMode&&<span style={{fontSize:9,color:"#4ade80"}}>✓</span>}
            {revMode&&<span style={{fontSize:9,color:"#818cf8",background:"#1a1a30",padding:"1px 8px",borderRadius:8}}>cold solve · no hints</span>}
            {/* Fluency badge */}
            {solved.has(prob.id)&&conf(prob.id)!==null&&(
              <span style={{fontSize:9,color:fluencyColor(conf(prob.id)),background:"var(--deep)",border:`1px solid ${fluencyColor(conf(prob.id))}30`,padding:"1px 7px",borderRadius:8}}>
                {conf(prob.id)}% {fluencyLabel(conf(prob.id))}
              </span>
            )}
            <a href={`https://leetcode.com/problems/${prob.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}/`} target="_blank" rel="noopener noreferrer" style={{marginLeft:"auto",fontSize:9,color:"var(--text4)",textDecoration:"none"}}>LC#{prob.lc}↗</a>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",background:"var(--sidebar)",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            {[["desc","Problem"],["solution","Optimal"+((!solved.has(prob.id)&&!showSol)?" 🔒":"")],["notes","Notes"]].map(([k,label])=>(
              <button key={k} onClick={()=>setTab(k)} style={{padding:"5px 13px",fontSize:9.5,background:"none",border:"none",borderBottom:tab===k?"2px solid #fbbf24":"2px solid transparent",color:tab===k?"#fbbf24":"var(--text3)",cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
            ))}
          </div>

          {/* Content */}
          <div style={{flex:1,overflowY:"auto",padding:14,fontSize:11.5,lineHeight:1.8,color:"var(--text2)"}}>
            {tab==="desc"&&<pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit",margin:0}}>{prob.desc}</pre>}
            {tab==="solution"&&(
              !solved.has(prob.id)&&!showSol?(
                <div style={{textAlign:"center",paddingTop:36}}>
                  <div style={{color:"var(--text3)",fontSize:12,marginBottom:14}}>Solve it first — or peek:</div>
                  <button onClick={()=>setShowSol(true)} style={{padding:"7px 18px",background:"#1a1a30",border:"1px solid #3a3a60",color:"#818cf8",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontSize:10}}>Show anyway</button>
                </div>
              ):(
                <div>
                  <div style={{marginBottom:10,padding:"8px 10px",background:"var(--panel)",borderRadius:5,border:"1px solid #1a3050"}}>
                    <div style={{fontSize:9,color:"#f59e0b",marginBottom:3,fontWeight:700}}>KEY INSIGHT</div>
                    <div style={{fontSize:10.5,color:"#7a9ab8"}}>{prob.note}</div>
                  </div>
                  <pre style={{background:"var(--code)",border:"1px solid #1e3a5f",borderRadius:5,padding:"10px 12px",fontSize:11.5,overflowX:"auto",lineHeight:1.6,margin:0}}><code style={{color:"var(--codetext)"}}>{prob.sol}</code></pre>
                </div>
              )
            )}
            {tab==="notes"&&(
              <textarea value={notes[prob.id]||""} onChange={e=>setNotes(p=>({...p,[prob.id]:e.target.value}))}
                placeholder={`# ${prob.title}\nKey insight:\nTime: O(?)\nSpace: O(?)`}
                style={{width:"100%",height:"100%",background:"transparent",border:"none",outline:"none",resize:"none",fontFamily:"inherit",fontSize:11.5,color:"var(--text2)",lineHeight:1.75}}/>
            )}
          </div>

          {/* Code editor */}
          <div style={{height:205,display:"flex",flexDirection:"column",borderTop:`1px solid ${revMode?"#3a1010":"var(--border)"}`,flexShrink:0}}>
            <div style={{padding:"3px 12px",background:"var(--panel)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:8.5,color:"var(--border)"}}>solution.py</span>
              <span style={{fontSize:8.5,color:revMode?"#f87171":peeking?"#fbbf24":"var(--border)",transition:"color 0.3s"}}>
                {revMode?`⏱ ${fmtTime(revSecs)}`:peeking?"👁 watching...":"Python 3"}
              </span>
            </div>
            <textarea value={code} onChange={e=>setCode(e.target.value)} spellCheck={false}
              style={{flex:1,background:revMode?"#08080e":"var(--code)",color:"var(--codetext)",fontFamily:"'JetBrains Mono',monospace",fontSize:12.5,padding:"9px 12px",border:"none",outline:"none",resize:"none",lineHeight:1.6}}/>
          </div>

          {/* Action bar */}
          <div style={{padding:"6px 12px",background:"var(--panel)",display:"flex",gap:7,borderTop:"1px solid var(--border)",flexShrink:0,alignItems:"center"}}>
            {revMode?(
              <>
                <button onClick={markRevSolved} style={{padding:"5px 14px",background:"#fbbf24",border:"none",color:"#000",borderRadius:3,fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>✓ Submit Revision</button>
                <span style={{fontSize:9,color:"var(--text3)"}}>Cold solve &lt;15min = {REV_XP_MULT}× XP</span>
              </>
            ):(
              <>
                <button onClick={markSolved} disabled={solved.has(prob.id)} style={{padding:"5px 12px",background:solved.has(prob.id)?"var(--border)":"#fbbf24",border:"none",color:solved.has(prob.id)?"var(--text3)":"#000",borderRadius:3,fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>
                  {solved.has(prob.id)?"✓ Solved":"Submit"}
                </button>
                <button onClick={()=>call("Review my code.",true)} style={{padding:"5px 10px",background:"none",border:"1px solid #1e3050",color:"var(--text3)",borderRadius:3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Review</button>
                <button onClick={()=>call("Hint please.")} style={{padding:"5px 10px",background:"none",border:"1px solid #1e3050",color:"var(--text3)",borderRadius:3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Hint</button>
                {solved.has(prob.id)&&<button onClick={()=>startRevision(prob)} style={{padding:"5px 10px",background:"none",border:"1px solid #2a3a80",color:"#818cf8",borderRadius:3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>📖 Revise</button>}
              </>
            )}
            <div style={{marginLeft:"auto",display:"flex",gap:4}}>
              {Array.from({length:dailyGoal}).map((_,i)=>(
                <div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<todayDone.size?"#4ade80":"var(--border)"}}/>
              ))}
            </div>
          </div>
        </div>

        {/* ── CHAT ── */}
        <div style={{width:265,display:"flex",flexDirection:"column",borderLeft:`1px solid ${revMode?"#3a1010":"var(--border)"}`,background:revMode?"#070408":"var(--chat)",flexShrink:0}}>

          {/* Chat header */}
          <div style={{padding:"7px 12px",background:"var(--panel)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:revMode?"#818cf8":peeking?"#fbbf24":"#4ade80",display:"inline-block",boxShadow:peeking?"0 0 6px #fbbf24":"none",transition:"all 0.3s"}}/>
            <span style={{fontSize:11,fontWeight:600,color:revMode?"#818cf8":"var(--text)"}}>{revMode?"Sensei (silent)":"Sensei"}</span>
            {peeking&&<span style={{fontSize:8.5,color:"#fbbf24",animation:"blink 1s infinite"}}>watching</span>}
            {!revMode&&<button onClick={()=>setPeekOn(p=>!p)} style={{marginLeft:"auto",padding:"1px 7px",background:peekOn?"#0f1a10":"#1a1010",border:`1px solid ${peekOn?"#1a3020":"#3a1010"}`,color:peekOn?"#4ade80":"#f87171",borderRadius:3,fontSize:8.5,cursor:"pointer",fontFamily:"inherit"}}>
              {peekOn?"👁 on":"👁 off"}
            </button>}
          </div>

          {/* Revision mode notice */}
          {revMode&&<div style={{padding:"8px 12px",background:"#0a0820",borderBottom:"1px solid #1a1030",fontSize:10,color:"#3a3060",lineHeight:1.5}}>
            Sensei is quiet. You're on your own. Prove you know it cold.<br/>
            <span style={{color:"#1a1040"}}>Ask a question → "You're on your own."</span>
          </div>}

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"8px 7px",display:"flex",flexDirection:"column",gap:7}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{padding:"6px 8px",borderRadius:5,fontSize:11.5,lineHeight:1.6,maxWidth:"96%",
                background:m.role==="user"?"var(--chatuser)":m.peek?"#0a1a10":"var(--chatmsg)",
                color:m.role==="user"?"#5a8ab0":m.peek?"#6ab88a":"#8aa0b8",
                border:m.role==="user"?"1px solid #1a3050":m.peek?"1px solid #1a3020":"1px solid var(--border3)",
                alignSelf:m.role==="user"?"flex-end":"flex-start"}}>
                {m.peek&&<span style={{fontSize:8,color:"#3a6040",marginRight:5}}>👁</span>}
                <Msg text={m.content}/>
              </div>
            ))}
            {aiLoad&&<div style={{padding:"6px 8px",borderRadius:5,fontSize:11,background:"var(--chatmsg)",border:"1px solid var(--border3)",alignSelf:"flex-start",color:"var(--text3)",animation:"blink 1.2s infinite"}}>...</div>}
            <div ref={chatRef}/>
          </div>

          {/* Quick actions */}
          {!revMode&&<div style={{padding:"4px 7px",borderTop:"1px solid var(--border)",display:"flex",flexWrap:"wrap",gap:3}}>
            {[["Hint","Hint please."],["Complexity?","Target complexity?"],["Edge cases?","What edge cases?"],["Pattern?","What's the pattern?"]].map(([l,m])=>(
              <button key={l} onClick={()=>call(m)} disabled={aiLoad}
                style={{padding:"3px 7px",background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:3,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>}

          {/* Input */}
          <div style={{padding:"7px",borderTop:"1px solid var(--border)",display:"flex",gap:5,flexShrink:0}}>
            <input value={inp} onChange={e=>setInp(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();call(inp);}}}
              placeholder={revMode?"You're on your own...":"Ask..."}
              disabled={aiLoad}
              style={{flex:1,background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text)",padding:"6px 8px",borderRadius:3,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
            <button onClick={()=>call(inp)} disabled={aiLoad||!inp.trim()}
              style={{padding:"6px 10px",background:inp.trim()&&!aiLoad?"#fbbf24":"var(--border)",border:"none",color:inp.trim()&&!aiLoad?"#000":"var(--text4)",borderRadius:3,fontSize:11,cursor:"pointer",fontWeight:700,transition:"background 0.15s"}}>→</button>
          </div>
        </div>

      </div>
      )}
    </div>
  );
}
