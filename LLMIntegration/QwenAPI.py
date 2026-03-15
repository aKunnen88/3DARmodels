import os
import sys
from openai import OpenAI
from dotenv import load_dotenv

# Fix Windows console encoding for Unicode/emoji output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Load environment variables from .env file relative to this script
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path)

if not os.getenv("NVIDIA_API_KEY"):
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

api_key = os.getenv("NVIDIA_API_KEY")
if not api_key:
    print("Error: NVIDIA_API_KEY not found in .env file")
    sys.exit(1)

client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = api_key
)

# Load Arduino Expert skill as system context
_skill_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ArduinoExpert', 'Skill.md')
_skill_content = ""
if os.path.exists(_skill_path):
    with open(_skill_path, 'r', encoding='utf-8') as f:
        _skill_content = f.read()

def chat_interactive():
    print("Qwen 3.5 Interactive Chat (type 'exit' or 'quit' to stop)")
    messages = []
    if _skill_content:
        messages.append({"role": "system", "content": _skill_content})
    
    while True:
        try:
            user_input = input("\nYou: ")
        except EOFError:
            break
        if user_input.lower() in ["exit", "quit"]:
            break
            
        messages.append({"role": "user", "content": user_input})
        
        try:
            completion = client.chat.completions.create(
                model="qwen/qwen3.5-122b-a10b",
                messages=messages,
                temperature=0.6,
                top_p=0.95,
                max_tokens=16384,
                stream=True,
                extra_body={"chat_template_kwargs": {"enable_thinking": True}}
            )

            sys.stdout.write("Qwen: ")
            sys.stdout.flush()
            full_response = ""
            in_thinking = False
            for chunk in completion:
                if not getattr(chunk, "choices", None):
                    continue
                delta = chunk.choices[0].delta
                # Handle thinking/reasoning tokens
                reasoning = getattr(delta, "reasoning_content", None)
                if reasoning:
                    if not in_thinking:
                        sys.stdout.write("[Thinking...] ")
                        sys.stdout.flush()
                        in_thinking = True
                    continue
                content = delta.content
                if content is not None:
                    if in_thinking:
                        sys.stdout.write("\n")
                        in_thinking = False
                    sys.stdout.write(content)
                    sys.stdout.flush()
                    full_response += content
            
            sys.stdout.write("\n")
            sys.stdout.flush()
            messages.append({"role": "assistant", "content": full_response})
            
        except Exception as e:
            print(f"\nError: {e}")

if __name__ == "__main__":
    chat_interactive()

