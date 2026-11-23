import asyncio
import os
import sys
import uvicorn

async def forward(reader, writer, target_port=8000):
    try:
        t_reader, t_writer = await asyncio.open_connection('127.0.0.1', target_port)
    except Exception:
        writer.close()
        return

    async def pipe(r, w):
        try:
            while not r.at_eof():
                data = await r.read(65536)
                if not data:
                    break
                w.write(data)
                await w.drain()
        except Exception:
            pass
        finally:
            try:
                w.close()
            except Exception:
                pass

    asyncio.create_task(pipe(reader, t_writer))
    asyncio.create_task(pipe(t_reader, writer))

async def start_proxy(port, target_port=8000):
    server = await asyncio.start_server(lambda r, w: forward(r, w, target_port), '0.0.0.0', port)
    async with server:
        await server.serve_forever()

async def main():
    ports_str = os.environ.get('ML_EXTRA_PORTS', '8003,8004,8005,8013')
    ports = [int(p) for p in ports_str.split(',') if p.strip()]
    for p in ports:
        asyncio.create_task(start_proxy(p, 8000))
    from main import app
    config = uvicorn.Config(app, host='0.0.0.0', port=8000, log_level='info')
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == '__main__':
    asyncio.run(main())
