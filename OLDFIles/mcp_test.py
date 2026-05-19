
import requests
import json
import threading

def sse_client():
    headers = {'Accept': 'text/event-stream'}
    response = requests.get('http://127.0.0.1:8080/mcp', headers=headers, stream=True)
    post_endpoint = None
    
    for line in response.iter_lines():
        if line:
            text = line.decode('utf-8')
            print('SSE:', text)
            if text.startswith('event: endpoint'):
                # We need the next line which is the data
                pass
            elif text.startswith('data: '):
                data = text[6:]
                if 'mcp/message' in data: # Usually the endpoint URL comes here
                    post_endpoint = 'http://127.0.0.1:8080' + data
                    print('Found POST endpoint:', post_endpoint)
                    
                    # Send tools/list request
                    req = {
                        'jsonrpc': '2.0',
                        'id': 1,
                        'method': 'tools/list',
                        'params': {}
                    }
                    res = requests.post(post_endpoint, json=req)
                    print('Tools:', res.text)
                    
                    # Exit after successful query
                    import os
                    os._exit(0)

