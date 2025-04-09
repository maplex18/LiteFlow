import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get('url');

    console.log('[Proxy GET] 收到請求:', {
        originalUrl: request.url,
        targetUrl: targetUrl || '未提供'
    });

    if (!targetUrl) {
        console.error('[Proxy GET] 未提供 URL 參數');
        return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    // 規範化 URL，確保沒有雙斜線問題
    try {
        // 處理相對路徑的情況
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            // 獲取當前請求的 origin
            const origin = url.origin;
            console.log('[Proxy GET] 處理相對路徑:', {
                origin,
                targetUrl
            });
            
            // 確保 targetUrl 開頭沒有斜線
            if (targetUrl.startsWith('/')) {
                targetUrl = targetUrl.slice(1);
                console.log('[Proxy GET] 移除開頭斜線:', targetUrl);
            }
            // 構建完整 URL
            targetUrl = `${origin}/${targetUrl}`;
            console.log('[Proxy GET] 構建完整 URL:', targetUrl);
        }
        
        // 嘗試直接解析 URL，如果成功則使用標準化的 URL
        const parsedUrl = new URL(targetUrl);
        
        // 規範化路徑，避免雙斜線
        const originalPath = parsedUrl.pathname;
        const normalizedPath = parsedUrl.pathname.replace(/\/+/g, '/');
        parsedUrl.pathname = normalizedPath;
        
        if (originalPath !== normalizedPath) {
            console.log('[Proxy GET] 規範化路徑:', {
                originalPath,
                normalizedPath
            });
        }
        
        targetUrl = parsedUrl.toString();
        console.log('[Proxy GET] 規範化後的 URL:', targetUrl);
    } catch (error) {
        console.error('[Proxy GET] 無效的 URL 格式:', targetUrl, error);
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    console.log('[Proxy GET] 轉發請求到:', targetUrl);

    try {
        // 添加請求頭
        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        
        console.log('[Proxy GET] 發送請求...');
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: headers
        });
        
        // 檢查響應狀態
        if (!response.ok) {
            console.error('[Proxy GET] 請求失敗:', {
                status: response.status,
                statusText: response.statusText,
                url: targetUrl
            });
            return NextResponse.json(
                { error: `Request failed with status: ${response.status}` },
                { status: response.status }
            );
        }
        
        console.log('[Proxy GET] 請求成功，解析響應...');
        const data = await response.json();

        console.log('[Proxy GET] 請求成功:', {
            status: response.status,
            hasData: !!data,
            dataType: typeof data,
            isArray: Array.isArray(data)
        });

        return NextResponse.json(data, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('[Proxy GET] 請求失敗:', {
            error: error instanceof Error ? error.message : String(error),
            url: targetUrl
        });
        return NextResponse.json(
            { 
                error: 'Failed to fetch resource',
                details: error instanceof Error ? error.message : String(error),
                url: targetUrl
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get('url');

    console.log('[Proxy POST] 收到請求:', {
        originalUrl: request.url,
        targetUrl: targetUrl || '未提供'
    });

    if (!targetUrl) {
        console.error('[Proxy POST] 未提供 URL 參數');
        return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    // 規範化 URL，確保沒有雙斜線問題
    try {
        // 處理相對路徑的情況
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            // 獲取當前請求的 origin
            const origin = url.origin;
            console.log('[Proxy POST] 處理相對路徑:', {
                origin,
                targetUrl
            });
            
            // 確保 targetUrl 開頭沒有斜線
            if (targetUrl.startsWith('/')) {
                targetUrl = targetUrl.slice(1);
                console.log('[Proxy POST] 移除開頭斜線:', targetUrl);
            }
            // 構建完整 URL
            targetUrl = `${origin}/${targetUrl}`;
            console.log('[Proxy POST] 構建完整 URL:', targetUrl);
        }
        
        // 嘗試直接解析 URL，如果成功則使用標準化的 URL
        const parsedUrl = new URL(targetUrl);
        
        // 規範化路徑，避免雙斜線
        const originalPath = parsedUrl.pathname;
        const normalizedPath = parsedUrl.pathname.replace(/\/+/g, '/');
        parsedUrl.pathname = normalizedPath;
        
        if (originalPath !== normalizedPath) {
            console.log('[Proxy POST] 規範化路徑:', {
                originalPath,
                normalizedPath
            });
        }
        
        targetUrl = parsedUrl.toString();
        console.log('[Proxy POST] 規範化後的 URL:', targetUrl);
    } catch (error) {
        console.error('[Proxy POST] 無效的 URL 格式:', targetUrl, error);
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    console.log('[Proxy POST] 轉發請求到:', targetUrl);

    try {
        const body = await request.json();
        console.log('[Proxy POST] 請求體:', {
            hasBody: !!body,
            bodyType: typeof body
        });
        
        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        
        console.log('[Proxy POST] 發送請求...');
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        // 檢查響應狀態
        if (!response.ok) {
            console.error('[Proxy POST] 請求失敗:', {
                status: response.status,
                statusText: response.statusText,
                url: targetUrl
            });
            return NextResponse.json(
                { error: `Request failed with status: ${response.status}` },
                { status: response.status }
            );
        }
        
        console.log('[Proxy POST] 請求成功，解析響應...');
        const data = await response.json();

        console.log('[Proxy POST] 請求成功:', {
            status: response.status,
            hasData: !!data,
            dataType: typeof data,
            isArray: Array.isArray(data)
        });

        return NextResponse.json(data, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('[Proxy POST] 請求失敗:', {
            error: error instanceof Error ? error.message : String(error),
            url: targetUrl
        });
        return NextResponse.json(
            { 
                error: 'Failed to fetch resource',
                details: error instanceof Error ? error.message : String(error),
                url: targetUrl
            },
            { status: 500 }
        );
    }
} 