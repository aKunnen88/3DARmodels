import streamlit as st
import os
import requests
import json
from openai import OpenAI
from dotenv import load_dotenv

# Page config
st.set_page_config(page_title="Qwen 3.5 Chat", page_icon="🤖", layout="wide")

# Custom CSS for premium look
st.markdown("""
    <style>
    .stChatMessage {
        border-radius: 15px;
        padding: 15px;
        margin: 10px 0;
    }
    .stChatInputContainer {
        padding-bottom: 20px;
    }
    .st-emotion-cache-18ni7ap {
        background-color: #f0f2f6;
    }
    </style>
    """, unsafe_allow_html=True)

# Load environment variables from .env file relative to this script
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
print(f"DEBUG: Loading .env from {dotenv_path}")
load_dotenv(dotenv_path)

# Diagnostic: Check if API key is loaded
api_key = os.getenv("NVIDIA_API_KEY")
if not api_key:
    # Try root fallback
    print("DEBUG: API key not found in LLMIntegration/.env, trying root...")
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
    api_key = os.getenv("NVIDIA_API_KEY")

if not api_key:
    st.error("❌ NVIDIA_API_KEY not found! Please check your .env file.")
    st.stop()

print(f"DEBUG: API Key found: {'Yes' if api_key else 'No'}")

# Initialize OpenAI client (Identical to working CLI script)
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=api_key
)

# Load Arduino Expert skill as system context
_skill_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ArduinoExpert', 'Skill.md')
_skill_content = ""
if os.path.exists(_skill_path):
    with open(_skill_path, 'r', encoding='utf-8') as f:
        _skill_content = f.read()

st.title("🤖 Qwen 3.5 Interactive Chat")
st.caption("Powered by Qwen 3.5 via NVIDIA Integration")

# Initialize chat history and expert mode
if "messages" not in st.session_state:
    st.session_state.messages = []
if "arduino_expert" not in st.session_state:
    st.session_state.arduino_expert = False

# Display chat messages from history on app rerun
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Sidebar
with st.sidebar:
    st.header("Settings")

    # Arduino Expert toggle
    st.subheader("🔧 Skills")
    expert_toggled = st.toggle("Arduino Expert", value=st.session_state.arduino_expert)
    if expert_toggled != st.session_state.arduino_expert:
        st.session_state.arduino_expert = expert_toggled
        # Clear chat when toggling so the greeting resets cleanly
        st.session_state.messages = []
        if expert_toggled:
            st.session_state.messages.append({
                "role": "assistant",
                "content": "Hey! 👋 Qwen 3.5 here as your **personal Arduino Expert**. "
                           "Ask me anything about the ultrasonic sensor setup — wiring, pin connections, "
                           "code, troubleshooting — I've got you covered!"
            })
        st.rerun()

    st.divider()

    if st.button("Clear Chat History"):
        st.session_state.messages = []
        if st.session_state.arduino_expert:
            st.session_state.messages.append({
                "role": "assistant",
                "content": "Hey! 👋 Qwen 3.5 here as your **personal Arduino Expert**. "
                           "Ask me anything about the ultrasonic sensor setup — wiring, pin connections, "
                           "code, troubleshooting — I've got you covered!"
            })
        st.rerun()
    
    st.divider()
    
    with st.expander("Diagnostics"):
        if st.button("Test Connection"):
            with st.status("Testing..."):
                try:
                    test_response = client.chat.completions.create(
                        model="qwen/qwen3.5-122b-a10b",
                        messages=[{"role": "user", "content": "Say 'OK'"}],
                        max_tokens=10
                    )
                    st.success("Connection OK!")
                except Exception as e:
                    st.error(f"Failed: {e}")

# React to user input
if prompt := st.chat_input("What is on your mind?"):
    print(f"DEBUG: User input received: {prompt}")
    st.chat_message("user").markdown(prompt)
    st.session_state.messages.append({"role": "user", "content": prompt})

    print(f"DEBUG: Message history length: {len(st.session_state.messages)}")
    
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""
        
        try:
            print(f"DEBUG: (Assistant) Starting Streaming API call for: {prompt}")
            
            messages_data = [
                {"role": m["role"], "content": m["content"]}
                for m in st.session_state.messages
            ]
            if st.session_state.arduino_expert and _skill_content:
                messages_data.insert(0, {"role": "system", "content": _skill_content})
            
            stream = client.chat.completions.create(
                model="qwen/qwen3.5-122b-a10b",
                messages=messages_data,
                temperature=0.6,
                top_p=0.95,
                max_tokens=16384,
                stream=True,
                extra_body={"chat_template_kwargs": {"enable_thinking": True}}
            )

            thinking_done = False
            thinking_placeholder = st.empty()
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta:
                    delta = chunk.choices[0].delta
                    # Handle thinking/reasoning tokens
                    reasoning = getattr(delta, "reasoning_content", None)
                    if reasoning and not thinking_done:
                        thinking_placeholder.caption("🧠 Thinking...")
                        continue
                    content = delta.content
                    if content:
                        if not thinking_done:
                            thinking_done = True
                            thinking_placeholder.empty()
                        full_response += content
                        message_placeholder.markdown(full_response + "▌")
            
            if not thinking_done:
                thinking_placeholder.empty()
            message_placeholder.markdown(full_response)

            st.session_state.messages.append({"role": "assistant", "content": full_response})
            print("DEBUG: (Assistant) Streaming complete.")

        except Exception as e:
            print(f"DEBUG: (Assistant) API Error: {e}")
            st.error(f"Chat Error: {e}")
