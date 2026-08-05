# QuizBiblo API Key and Voice Flow

This diagram shows how two computers use one server-side set of API keys. The
player computers do not need Azure Speech or OpenAI keys.

## Two-Computer Local Hosting

```mermaid
sequenceDiagram
    autonumber
    participant A as PC 1: Host browser
    participant S as PC 1: QuizBiblo server<br/>API keys stored here
    participant B as PC 2: Player browser
    participant AZ as Azure Speech
    participant OAI as OpenAI

    Note over S: Stores AZURE_SPEECH_KEY<br/>and OPENAI_API_KEY<br/>Keys never leave the server

    A->>S: Create room / start question
    B->>S: Join room
    S-->>A: Room state and question
    S-->>B: Room state and question

    A->>A: Host clicks Enable audio
    B->>B: Player clicks Enable audio

    par Prepare Quizmaster audio
        A->>S: Request approved question audio
        B->>S: Request approved question audio
        S->>AZ: Send approved text with server key
        AZ-->>S: Return audio bytes
        S-->>A: Return audio bytes, no Azure key
        S-->>B: Return audio bytes, no Azure key
    end

    S-->>A: Start reading event
    S-->>B: Start reading event
    A->>A: Play Quizmaster audio
    B->>B: Play Quizmaster audio

    B->>B: Student speaks
    B->>B: Windows Voice Typing or Chrome dictation<br/>creates transcript locally
    B->>S: Send transcript text, not raw microphone audio
    S->>OAI: Send approved question + transcript<br/>with server key
    OAI-->>S: Return constrained grading result
    S-->>A: Correct, incorrect, or needs review
    S-->>B: Correct, incorrect, or needs review

    A->>S: Player buzzes
    S-->>A: Authoritative winner event
    S-->>B: Authoritative winner event
    A->>A: Stop local audio immediately
    B->>B: Stop local audio immediately
```

## Public Hosted Mode

The public URL works the same way, except the server is the hosted Sites/Worker
environment rather than the host's Windows PC.

```mermaid
flowchart LR
    subgraph Clients[Player computers]
        A[Host browser<br/>No API keys]
        B[Player browser<br/>No API keys]
    end

    subgraph Server[QuizBiblo hosted server]
        W[Worker / server routes]
        K[(Hosted secrets)]
        K1[AZURE_SPEECH_KEY]
        K2[AZURE_SPEECH_REGION]
        K3[OPENAI_API_KEY]
        K --- K1
        K --- K2
        K --- K3
    end

    AZ[Azure Speech]
    OAI[OpenAI]

    A <-->|Room state, audio, grading| W
    B <-->|Room state, audio, grading| W
    W -->|Server-side authenticated request| AZ
    W -->|Server-side authenticated request| OAI
    W --- K
```

## Key Rules

- The host player is not automatically the API-key owner. The server is the key owner.
- If one PC runs the local server, only that PC needs the keys.
- Every browser can join without an Azure or OpenAI key.
- Windows Voice Typing and Chrome dictation convert speech to text on the player's computer.
- QuizBiblo receives transcript text for grading; it does not need to receive raw microphone audio in the baseline design.
- Azure Speech and OpenAI keys must never be placed in browser JavaScript, local storage, GitHub, issue comments, or visible network payloads.
- If the server stops, local in-memory developer keys are lost and must be entered again.
- In production, hosted secrets remain with the hosting environment and are not entered into the player UI.
