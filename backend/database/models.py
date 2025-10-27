"""
Database models using SQLAlchemy ORM
Simple schema for conversation tracking and evaluation
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Float, JSON, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func

class Base(DeclarativeBase):
    pass


class Conversation(Base):
    """Conversation model for storing conversation data"""
    __tablename__ = 'conversation'
    
    internal_id = Column(Integer, primary_key=True, index=True)
    conversation_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship: one conversation has many responses
    responses = relationship("ConversationResponse", back_populates="conversation", cascade="all, delete-orphan")




class ConversationResponse(Base):
    """Conversation response model for storing AI responses"""
    __tablename__ = 'conversation_response'
    
    id = Column(Integer, primary_key=True, index=True)
    response = Column(Text, nullable=False)
    evaluation = Column(Float, nullable=True)  # Overall evaluation score
    rationality = Column(Float, nullable=True)  # Rationality score
    coherency = Column(Float, nullable=True)    # Coherency score
    elapsed_time = Column(Float, nullable=True)  # Response time in seconds
    first_token_time = Column(Float, nullable=True)  # Time to first token
    num_tool_calls = Column(Integer, nullable=True)  # Number of tool calls
    test_run_time = Column(DateTime(timezone=True), nullable=True)  # Timestamp for test suite iteration
    
    # Foreign key to conversation (many responses belong to one conversation)
    conversation_id = Column(Integer, ForeignKey('conversation.internal_id', ondelete='CASCADE'), nullable=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="responses")
    evaluation_detail = relationship("ConversationResponseEvaluation", back_populates="conversation_response", uselist=False, cascade="all, delete-orphan")


class ConversationResponseEvaluation(Base):
    """Conversation response evaluation model for detailed evaluations"""
    __tablename__ = 'conversation_response_evaluation'
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_json = Column(JSON, nullable=False)
    elapsed = Column(Float, nullable=True)      # Elapsed time
    rationality = Column(Float, nullable=True)  # Rationality score
    coherency = Column(Float, nullable=True)    # Coherency score
    
    # Foreign key to conversation response (one evaluation belongs to one response)
    conversation_response_id = Column(Integer, ForeignKey('conversation_response.id', ondelete='CASCADE'), nullable=True)
    
    # Relationship
    conversation_response = relationship("ConversationResponse", back_populates="evaluation_detail")

class Issue(Base):
    """Issue model for storing evaluation issues"""
    __tablename__ = 'issue'
    
    id = Column(Integer, primary_key=True, index=True)
    description = Column(JSON, nullable=False)  # Store issues as JSON array
    
    # Foreign key to conversation response (many issues belong to one response)
    conversation_response_id = Column(Integer, ForeignKey('conversation_response.id', ondelete='CASCADE'), nullable=True)
    