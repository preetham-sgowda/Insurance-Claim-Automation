"""
NexSettle - CrewAI Agentic Pipeline Orchestrator
Uses CrewAI agents for orchestration and delegates execution to existing pipeline logic.
"""

import logging
from typing import Any

from django.conf import settings

from .pipeline import run_pipeline as run_langgraph_pipeline

logger = logging.getLogger("nexsettle")


def _build_crew_orchestration(claim_id: str, files: list[dict]) -> dict[str, Any]:
    """
    Runs a lightweight CrewAI orchestration plan and returns trace metadata.
    This keeps document processing deterministic while still using Agentic AI.
    """
    try:
        from crewai import Agent, Crew, Process, Task
    except Exception as e:
        return {
            "enabled": False,
            "error": f"CrewAI import failed: {str(e)}",
        }

    if not settings.USE_GEMINI or not settings.GEMINI_API_KEY:
        return {
            "enabled": False,
            "error": "CrewAI requires USE_GEMINI=True and a valid GEMINI_API_KEY",
        }

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0,
        )

        classifier_agent = Agent(
            role="Document Classification Agent",
            goal="Classify claim documents into supported document types with strict confidence.",
            backstory="You specialize in insurance document taxonomy and format validation.",
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
        extractor_agent = Agent(
            role="Data Extraction Agent",
            goal="Extract schema-compliant structured fields and never hallucinate missing values.",
            backstory="You are an expert in OCR post-processing and form field normalization.",
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
        fraud_agent = Agent(
            role="Fraud Detection Agent",
            goal="Identify cross-document inconsistencies and format anomalies.",
            backstory="You audit insurance claims for signals of potential fraud.",
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
        verification_agent = Agent(
            role="Policy Verification Agent",
            goal="Cross-check extracted identities against policy holder records.",
            backstory="You validate policy eligibility for claim settlement.",
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )
        estimator_agent = Agent(
            role="Claim Estimation Agent",
            goal="Estimate payout using claim type and fraud signals.",
            backstory="You apply deterministic insurance payout rules safely.",
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )

        file_names = [f.get("original_name", "unknown") for f in files]
        context_text = (
            f"Claim ID: {claim_id}\n"
            f"Files: {file_names}\n"
            "Return concise planning notes only."
        )

        tasks = [
            Task(
                description=f"Plan classification strategy.\n{context_text}",
                expected_output="Short plan for classification and invalid-format handling.",
                agent=classifier_agent,
            ),
            Task(
                description=f"Plan extraction and schema normalization.\n{context_text}",
                expected_output="Short plan for deterministic extraction and null handling.",
                agent=extractor_agent,
            ),
            Task(
                description=f"Plan fraud checks across documents.\n{context_text}",
                expected_output="Short plan for fraud checks and mismatch rules.",
                agent=fraud_agent,
            ),
            Task(
                description=f"Plan policy verification strategy.\n{context_text}",
                expected_output="Short plan for policy lookup and claimant matching.",
                agent=verification_agent,
            ),
            Task(
                description=f"Plan claim estimation logic.\n{context_text}",
                expected_output="Short plan for payout calculation.",
                agent=estimator_agent,
            ),
        ]

        crew = Crew(
            agents=[
                classifier_agent,
                extractor_agent,
                fraud_agent,
                verification_agent,
                estimator_agent,
            ],
            tasks=tasks,
            process=Process.sequential,
            verbose=False,
        )
        crew_output = crew.kickoff()
        return {
            "enabled": True,
            "status": "success",
            "plan": str(crew_output)[:4000],
        }
    except Exception as e:
        return {
            "enabled": False,
            "error": f"CrewAI orchestration failed: {str(e)}",
        }


def run_pipeline_with_crew(files: list, user_unique_id: str, claim_id: str) -> dict:
    """
    Run CrewAI orchestration + existing deterministic execution pipeline.
    """
    trace = _build_crew_orchestration(claim_id=claim_id, files=files)
    if trace.get("enabled"):
        logger.info("CrewAI orchestration completed for claim %s", claim_id)
    else:
        logger.warning("CrewAI orchestration unavailable for claim %s: %s", claim_id, trace.get("error"))

    result = run_langgraph_pipeline(
        files=files,
        user_unique_id=user_unique_id,
        claim_id=claim_id,
    )
    result["agentic_orchestrator"] = "crewai"
    result["agentic_trace"] = trace
    return result

