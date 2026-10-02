# wakatime-cli contract fixtures

Copied unchanged from [wakatime/wakatime-cli](https://github.com/wakatime/wakatime-cli)
`pkg/api/testdata/` at commit `05f417c` (2026-09-28). They pin what the real
client sends and parses, so the v1 compatibility routes are tested against
the client rather than against our reading of it.

| File | Used by |
| --- | --- |
| `api_heartbeats_request.json` | `POST /users/current/heartbeats.bulk` request body (`handlers/v1/heartbeats.rs` tests) |
| `api_statusbar_today_response.json` | shape of `GET /users/current/statusbar/today` (`handlers/v1/status_bar.rs` tests) |

wakatime-cli is BSD 3-Clause licensed:

> Copyright (c) 2021, WakaTime, LLC. All rights reserved.
>
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are met:
> 1. Redistributions of source code must retain the above copyright notice,
>    this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice,
>    this list of conditions and the following disclaimer in the documentation
>    and/or other materials provided with the distribution.
> 3. Neither the name of the copyright holder nor the names of its
>    contributors may be used to endorse or promote products derived from
>    this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
> AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
> IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
> ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
> LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
> CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
> SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
> INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
> CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
> ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
> POSSIBILITY OF SUCH DAMAGE.
